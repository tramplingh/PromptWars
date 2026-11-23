import { findFreeSlots, hasCapacity } from './availability.js';
import type { Booking, Equipment, Lab, TimeSlot } from './domain.js';
import { slotHours } from './time.js';
import {
  capabilityFit,
  comparePriority,
  computeUsageHours,
  scoreRequest,
  type PriorityScore,
} from './scoring.js';

/**
 * Deterministic, explainable conflict-resolution engine.
 *
 * Every contending request receives a priority score from four transparent
 * factors. The highest-priority feasible requests keep the contested slot; the
 * rest are offered the closest fair alternative (an equivalent device at the
 * same time, or the same device at another time before their deadline).
 *
 * The engine is pure: same inputs → same plan. Gemini is only used to *explain*
 * a plan in natural language, never to decide it.
 */

export interface ConflictGroup {
  /** Stable id: `${equipmentId}_${date}_${startHour}-${endHour}`. */
  id: string;
  equipmentId: string;
  date: string;
  startHour: number;
  endHour: number;
  /** Pending requests competing for the window. */
  pendingIds: string[];
  /** Already-approved bookings occupying part of the window. */
  approvedIds: string[];
}

/**
 * Finds windows on one equipment where active demand exceeds the unit count
 * and at least one pending request is involved.
 */
export function detectConflicts(
  equipment: Equipment,
  bookings: readonly Booking[],
): ConflictGroup[] {
  const active = bookings
    .filter(
      (b) => b.equipmentId === equipment.id && (b.status === 'pending' || b.status === 'approved'),
    )
    .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.startHour - b.slot.startHour);

  // Each cluster is non-empty by construction (it starts with the booking that opened it).
  const clusters: [Booking, ...Booking[]][] = [];
  let current: [Booking, ...Booking[]] | null = null;
  let clusterEnd = -1;
  let clusterDate = '';
  for (const b of active) {
    if (current && b.slot.date === clusterDate && b.slot.startHour < clusterEnd) {
      current.push(b);
      clusterEnd = Math.max(clusterEnd, b.slot.endHour);
    } else {
      if (current) clusters.push(current);
      current = [b];
      clusterDate = b.slot.date;
      clusterEnd = b.slot.endHour;
    }
  }
  if (current) clusters.push(current);

  return clusters
    .filter((c) => c.some((b) => b.status === 'pending') && exceedsCapacity(equipment, c))
    .map((c) => {
      const startHour = Math.min(...c.map((b) => b.slot.startHour));
      const endHour = Math.max(...c.map((b) => b.slot.endHour));
      const date = c[0].slot.date;
      return {
        id: `${equipment.id}_${date}_${startHour}-${endHour}`,
        equipmentId: equipment.id,
        date,
        startHour,
        endHour,
        pendingIds: c.filter((b) => b.status === 'pending').map((b) => b.id),
        approvedIds: c.filter((b) => b.status === 'approved').map((b) => b.id),
      };
    });
}

function exceedsCapacity(equipment: Equipment, cluster: readonly Booking[]): boolean {
  const start = Math.min(...cluster.map((b) => b.slot.startHour));
  const end = Math.max(...cluster.map((b) => b.slot.endHour));
  for (let hour = start; hour < end; hour++) {
    const load = cluster.filter((b) => b.slot.startHour <= hour && hour < b.slot.endHour).length;
    if (load > equipment.units) return true;
  }
  return false;
}

export type AlternativeKind = 'equivalent-same-time' | 'same-equipment-other-time';

export interface Alternative {
  kind: AlternativeKind;
  equipmentId: string;
  slot: TimeSlot;
}

export interface AllocationDecision {
  bookingId: string;
  userId: string;
  rank: number;
  outcome: 'allocate' | 'reassign';
  score: PriorityScore;
  /** Ordered best-first; the first entry is the recommended move for a reassigned request. */
  alternatives: Alternative[];
}

export interface AllocationPlan {
  conflict: ConflictGroup;
  decisions: AllocationDecision[];
  summary: string;
}

export interface ResolveInput {
  conflict: ConflictGroup;
  /** Every booking in the system (used for capacity on alternatives). */
  bookings: readonly Booking[];
  equipment: readonly Equipment[];
  labs: readonly Lab[];
  today: string;
  now: string;
  /** Working days to search for alternative slots. */
  searchDays?: number;
}

export function resolveConflict(input: ResolveInput): AllocationPlan {
  const { conflict, bookings, today, now, searchDays = 10 } = input;
  const equipmentById = new Map(input.equipment.map((e) => [e.id, e]));
  const labById = new Map(input.labs.map((l) => [l.id, l]));
  const target = equipmentById.get(conflict.equipmentId);
  if (!target) throw new Error(`Unknown equipment ${conflict.equipmentId}`);

  const contenderIds = new Set(conflict.pendingIds);
  const contenders = bookings.filter((b) => contenderIds.has(b.id));
  const usageHours = computeUsageHours(bookings, today);

  const ranked = contenders
    .map((booking) => ({
      booking,
      score: scoreRequest(booking, { today, now, equipment: target, usageHours }),
    }))
    .sort(comparePriority);

  // Calendar the plan builds on: everything active except the contenders being decided.
  const calendar: Booking[] = bookings.filter(
    (b) => !contenderIds.has(b.id) && (b.status === 'approved' || b.status === 'pending'),
  );

  const decisions: AllocationDecision[] = ranked.map(({ booking, score }, index) => {
    const onTarget = calendar.filter((b) => b.equipmentId === target.id && b.status === 'approved');
    if (score.feasible && hasCapacity(target, onTarget, booking.slot)) {
      calendar.push({ ...booking, status: 'approved' });
      return {
        bookingId: booking.id,
        userId: booking.userId,
        rank: index + 1,
        outcome: 'allocate',
        score,
        alternatives: [],
      };
    }

    const alternatives = findAlternatives(
      booking,
      target,
      calendar,
      input.equipment,
      labById,
      today,
      searchDays,
    );
    const primary = alternatives[0];
    // Reserve the primary alternative so lower-ranked requests are not offered the same slot.
    if (primary) {
      calendar.push({
        ...booking,
        equipmentId: primary.equipmentId,
        slot: primary.slot,
        status: 'approved',
      });
    }
    return {
      bookingId: booking.id,
      userId: booking.userId,
      rank: index + 1,
      outcome: 'reassign',
      score,
      alternatives,
    };
  });

  return { conflict, decisions, summary: summarise(target, decisions) };
}

function findAlternatives(
  booking: Booking,
  target: Equipment,
  calendar: readonly Booking[],
  allEquipment: readonly Equipment[],
  labById: ReadonlyMap<string, Lab>,
  today: string,
  searchDays: number,
): Alternative[] {
  const alternatives: Alternative[] = [];
  const requirements = booking.project.requirements;
  const latestDate = booking.project.deadline;

  const equivalents = allEquipment
    .filter(
      (e) =>
        e.id !== target.id &&
        e.status === 'operational' &&
        e.category === target.category &&
        capabilityFit(requirements, e) >= capabilityFit(requirements, target),
    )
    .sort(
      (a, b) =>
        capabilityFit(requirements, b) - capabilityFit(requirements, a) || a.id.localeCompare(b.id),
    );

  for (const e of equivalents) {
    const lab = labById.get(e.labId);
    const fitsHours =
      lab && booking.slot.startHour >= lab.openHour && booking.slot.endHour <= lab.closeHour;
    if (
      fitsHours &&
      hasCapacity(
        e,
        calendar.filter((b) => b.equipmentId === e.id),
        booking.slot,
      )
    ) {
      alternatives.push({ kind: 'equivalent-same-time', equipmentId: e.id, slot: booking.slot });
      if (alternatives.length === 2) break;
    }
  }

  const targetLab = labById.get(target.labId);
  if (targetLab) {
    const slots = findFreeSlots({
      equipment: target,
      lab: targetLab,
      bookings: calendar.filter((b) => b.equipmentId === target.id),
      from: today,
      days: searchDays,
      durationHours: slotHours(booking.slot),
      latestDate,
      near: booking.slot,
      limit: 2,
    });
    for (const slot of slots)
      alternatives.push({ kind: 'same-equipment-other-time', equipmentId: target.id, slot });
  }

  return alternatives;
}

function summarise(target: Equipment, decisions: readonly AllocationDecision[]): string {
  const kept = decisions.filter((d) => d.outcome === 'allocate').length;
  const moved = decisions.filter(
    (d) => d.outcome === 'reassign' && d.alternatives.length > 0,
  ).length;
  const unplaced = decisions.length - kept - moved;
  const parts = [
    `${kept} request${kept === 1 ? '' : 's'} keep${kept === 1 ? 's' : ''} ${target.name}`,
  ];
  if (moved) parts.push(`${moved} moved to a fair alternative`);
  if (unplaced) parts.push(`${unplaced} without a feasible alternative before the deadline`);
  return `${parts.join(', ')}.`;
}
