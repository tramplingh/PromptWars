import { capabilityFit } from './allocation.js';
import { hasCapacity } from './availability.js';
import type { Booking, Equipment, Lab, TimeSlot } from './domain.js';
import { slotsOverlap, workingDays } from './time.js';

/**
 * Multi-equipment project scheduler.
 *
 * Gemini breaks a project into ordered steps (capabilities + hours); this pure
 * engine turns them into a *feasible* timetable: each step on the best-fitting
 * device anywhere on campus, after its prerequisites, inside lab hours, within
 * capacity, never overlapping the student's own bookings, and before the
 * deadline. Same input → same plan.
 */

export const MAX_PLAN_STEPS = 6;
/** How many working days ahead the planner searches. */
export const PLAN_HORIZON_DAYS = 22;

export interface PlanStepInput {
  id: string;
  title: string;
  /** Capability tags this step needs; the first is the primary one a device must offer. */
  requirements: string[];
  /** Total hands-on hours; split into sessions if a device caps booking length. */
  hours: number;
  /** Ids of steps that must finish first. */
  dependsOn: string[];
}

/** A point in time on the campus calendar: a date and a whole hour. */
export interface CalendarPoint {
  date: string;
  hour: number;
}

export type StepSchedule =
  | { stepId: string; status: 'scheduled'; equipmentId: string; fit: number; sessions: TimeSlot[] }
  | { stepId: string; status: 'unschedulable'; reason: string };

export interface ScheduleInput {
  steps: readonly PlanStepInput[];
  deadline: string;
  /** Earliest moment the first session may start. */
  from: CalendarPoint;
  equipment: readonly Equipment[];
  labs: readonly Lab[];
  /** Active bookings across campus (capacity) — the student's own are included. */
  bookings: readonly Booking[];
  userId: string;
  horizonDays?: number;
}

export interface ScheduleResult {
  /** In execution (dependency) order. */
  steps: StepSchedule[];
  feasible: boolean;
  /** End of the last session, when feasible. */
  finish?: CalendarPoint;
}

const isAfterOrAt = (slot: TimeSlot, point: CalendarPoint) =>
  slot.date > point.date || (slot.date === point.date && slot.startHour >= point.hour);

const endOf = (slot: TimeSlot): CalendarPoint => ({ date: slot.date, hour: slot.endHour });

const later = (a: CalendarPoint, b: CalendarPoint) =>
  a.date > b.date || (a.date === b.date && a.hour > b.hour) ? a : b;

/**
 * Orders steps so every step comes after its prerequisites (Kahn's algorithm).
 * Unknown dependencies are ignored; cycles are rejected.
 */
export function orderSteps(steps: readonly PlanStepInput[]): PlanStepInput[] {
  const ids = new Set(steps.map((s) => s.id));
  const pending = new Map(
    steps.map((s) => [s.id, new Set(s.dependsOn.filter((d) => ids.has(d) && d !== s.id))]),
  );
  const ordered: PlanStepInput[] = [];
  while (ordered.length < steps.length) {
    const ready = steps.find((s) => !ordered.includes(s) && pending.get(s.id)?.size === 0);
    if (!ready) throw new Error('Project steps have a circular dependency');
    ordered.push(ready);
    for (const deps of pending.values()) deps.delete(ready.id);
  }
  return ordered;
}

/** Splits hours into sessions no longer than the device allows. */
export function splitHours(hours: number, maxPerSession: number): number[] {
  const sessions: number[] = [];
  let remaining = Math.max(1, Math.round(hours));
  while (remaining > 0) {
    const chunk = Math.min(remaining, maxPerSession);
    sessions.push(chunk);
    remaining -= chunk;
  }
  return sessions;
}

interface SlotSearch {
  equipment: Equipment;
  lab: Lab;
  durationHours: number;
  after: CalendarPoint;
  deadline: string;
  calendar: readonly Booking[];
  userBusy: readonly TimeSlot[];
  horizonDays: number;
}

/** Earliest bookable slot on one device at or after `after`, ending by the deadline. */
export function earliestSlot(search: SlotSearch): TimeSlot | null {
  const { equipment, lab, durationHours, after, deadline, calendar, userBusy, horizonDays } =
    search;
  const onDevice = calendar.filter((b) => b.equipmentId === equipment.id);
  for (const date of workingDays(after.date, horizonDays)) {
    if (date > deadline) return null;
    for (let start = lab.openHour; start + durationHours <= lab.closeHour; start++) {
      const slot = { date, startHour: start, endHour: start + durationHours };
      if (!isAfterOrAt(slot, after)) continue;
      if (!hasCapacity(equipment, onDevice, slot)) continue;
      if (userBusy.some((busy) => slotsOverlap(busy, slot))) continue;
      return slot;
    }
  }
  return null;
}

/** Builds a feasible timetable for a whole project. */
export function scheduleProject(input: ScheduleInput): ScheduleResult {
  const horizonDays = input.horizonDays ?? PLAN_HORIZON_DAYS;
  const labById = new Map(input.labs.map((l) => [l.id, l]));
  const calendar: Booking[] = [...input.bookings];
  const userBusy: TimeSlot[] = input.bookings
    .filter((b) => b.userId === input.userId)
    .map((b) => b.slot);
  const finished = new Map<string, CalendarPoint | null>();
  const results: StepSchedule[] = [];

  for (const step of orderSteps(input.steps)) {
    const blocked = step.dependsOn.find((d) => finished.get(d) === null);
    if (blocked) {
      results.push({
        stepId: step.id,
        status: 'unschedulable',
        reason: 'An earlier step it depends on could not be scheduled',
      });
      finished.set(step.id, null);
      continue;
    }
    const after = step.dependsOn.reduce<CalendarPoint>((point, d) => {
      const end = finished.get(d);
      return end ? later(point, end) : point;
    }, input.from);

    // The first requirement is the step's primary capability: a device must offer it to be
    // considered (a 3D printer that is merely "high-precision" must never get a PCB-milling step).
    const primary = step.requirements[0];
    const operational = input.equipment.filter(
      (e) =>
        e.status === 'operational' && primary !== undefined && e.capabilities.includes(primary),
    );
    const bestFit = Math.max(0, ...operational.map((e) => capabilityFit(step.requirements, e)));
    if (step.requirements.length === 0 || bestFit === 0) {
      results.push({
        stepId: step.id,
        status: 'unschedulable',
        reason: 'No operational equipment on campus offers these capabilities',
      });
      finished.set(step.id, null);
      continue;
    }

    // Among the best-fitting devices, choose the one that finishes this step earliest.
    let best: { equipment: Equipment; sessions: TimeSlot[] } | null = null;
    for (const equipment of operational.filter(
      (e) => capabilityFit(step.requirements, e) === bestFit,
    )) {
      const lab = labById.get(equipment.labId);
      if (!lab) continue;
      const sessions: TimeSlot[] = [];
      let cursor = after;
      for (const duration of splitHours(step.hours, equipment.maxHoursPerBooking)) {
        const slot = earliestSlot({
          equipment,
          lab,
          durationHours: duration,
          after: cursor,
          deadline: input.deadline,
          calendar,
          userBusy: [...userBusy, ...sessions],
          horizonDays,
        });
        if (!slot) break;
        sessions.push(slot);
        cursor = endOf(slot);
      }
      if (sessions.length !== splitHours(step.hours, equipment.maxHoursPerBooking).length) continue;
      const candidate = { equipment, sessions };
      if (!best || compareCandidates(candidate, best) < 0) best = candidate;
    }

    if (!best) {
      results.push({
        stepId: step.id,
        status: 'unschedulable',
        reason: 'No free slot on suitable equipment before the deadline',
      });
      finished.set(step.id, null);
      continue;
    }

    // Reserve the sessions so later steps (and capacity) see them.
    for (const slot of best.sessions) {
      calendar.push(reservation(best.equipment.id, input.userId, slot));
      userBusy.push(slot);
    }
    finished.set(step.id, endOf(best.sessions[best.sessions.length - 1]!));
    results.push({
      stepId: step.id,
      status: 'scheduled',
      equipmentId: best.equipment.id,
      fit: bestFit,
      sessions: best.sessions,
    });
  }

  const feasible = results.every((r) => r.status === 'scheduled');
  const ends = [...finished.values()].filter((p): p is CalendarPoint => p !== null);
  return {
    steps: results,
    feasible,
    ...(feasible && ends.length > 0 && { finish: ends.reduce(later) }),
  };
}

const comparePoints = (a: CalendarPoint, b: CalendarPoint) =>
  a.date.localeCompare(b.date) || a.hour - b.hour;

/** Earlier finish wins; then instant-booking devices (no approval wait); then id for determinism. */
function compareCandidates(
  a: { equipment: Equipment; sessions: TimeSlot[] },
  b: { equipment: Equipment; sessions: TimeSlot[] },
): number {
  return (
    comparePoints(
      endOf(a.sessions[a.sessions.length - 1]!),
      endOf(b.sessions[b.sessions.length - 1]!),
    ) ||
    Number(a.equipment.requiresApproval) - Number(b.equipment.requiresApproval) ||
    a.equipment.id.localeCompare(b.equipment.id)
  );
}

function reservation(equipmentId: string, userId: string, slot: TimeSlot): Booking {
  return {
    id: `plan-${equipmentId}-${slot.date}-${slot.startHour}`,
    equipmentId,
    userId,
    slot,
    project: { title: 'plan', summary: 'plan', deadline: slot.date, requirements: [] },
    status: 'approved',
    createdAt: '1970-01-01T00:00:00.000Z',
  };
}
