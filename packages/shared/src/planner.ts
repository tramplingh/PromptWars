import { capabilityFit } from './scoring.js';
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

/** Mutable working state while a project is being scheduled step by step. */
interface PlanningState {
  input: ScheduleInput;
  horizonDays: number;
  labById: ReadonlyMap<string, Lab>;
  /** Campus bookings plus sessions already planned (for capacity). */
  calendar: Booking[];
  /** The student's own commitments plus planned sessions (no double-booking). */
  userBusy: TimeSlot[];
  /** End of each step; `null` when the step could not be scheduled. */
  finished: Map<string, CalendarPoint | null>;
}

interface Candidate {
  equipment: Equipment;
  sessions: TimeSlot[];
  finish: CalendarPoint;
}

const UNSCHEDULABLE = {
  blocked: 'An earlier step it depends on could not be scheduled',
  noDevice: 'No operational equipment on campus offers these capabilities',
  noSlot: 'No free slot on suitable equipment before the deadline',
} as const;

/** Builds a feasible timetable for a whole project. */
export function scheduleProject(input: ScheduleInput): ScheduleResult {
  const state: PlanningState = {
    input,
    horizonDays: input.horizonDays ?? PLAN_HORIZON_DAYS,
    labById: new Map(input.labs.map((l) => [l.id, l])),
    calendar: [...input.bookings],
    userBusy: input.bookings.filter((b) => b.userId === input.userId).map((b) => b.slot),
    finished: new Map(),
  };
  const steps = orderSteps(input.steps).map((step) => scheduleStep(step, state));
  const feasible = steps.every((r) => r.status === 'scheduled');
  const ends = [...state.finished.values()].filter((p): p is CalendarPoint => p !== null);
  return { steps, feasible, ...(feasible && ends.length > 0 && { finish: ends.reduce(later) }) };
}

function scheduleStep(step: PlanStepInput, state: PlanningState): StepSchedule {
  const fail = (reason: string): StepSchedule => {
    state.finished.set(step.id, null);
    return { stepId: step.id, status: 'unschedulable', reason };
  };
  if (step.dependsOn.some((d) => state.finished.get(d) === null))
    return fail(UNSCHEDULABLE.blocked);

  const { devices, fit } = bestFittingDevices(step, state.input.equipment);
  if (devices.length === 0) return fail(UNSCHEDULABLE.noDevice);

  const after = step.dependsOn.reduce<CalendarPoint>((point, d) => {
    const end = state.finished.get(d);
    return end ? later(point, end) : point;
  }, state.input.from);
  const best = devices
    .map((equipment) => planOnDevice(step, equipment, after, state))
    .filter((c): c is Candidate => c !== null)
    .sort(compareCandidates)[0];
  if (!best) return fail(UNSCHEDULABLE.noSlot);

  // Reserve the sessions so later steps (and capacity checks) see them.
  for (const slot of best.sessions) {
    state.calendar.push(reservation(best.equipment.id, state.input.userId, slot));
    state.userBusy.push(slot);
  }
  state.finished.set(step.id, best.finish);
  return {
    stepId: step.id,
    status: 'scheduled',
    equipmentId: best.equipment.id,
    fit,
    sessions: best.sessions,
  };
}

/**
 * Operational devices offering the step's primary (first) capability, narrowed
 * to those with the best overall fit. A 3D printer that is merely
 * "high-precision" must never receive a PCB-milling step.
 */
export function bestFittingDevices(
  step: PlanStepInput,
  equipment: readonly Equipment[],
): { devices: Equipment[]; fit: number } {
  const [primary] = step.requirements;
  if (primary === undefined) return { devices: [], fit: 0 };
  const offering = equipment.filter(
    (e) => e.status === 'operational' && e.capabilities.includes(primary),
  );
  const fit = Math.max(0, ...offering.map((e) => capabilityFit(step.requirements, e)));
  return { devices: offering.filter((e) => capabilityFit(step.requirements, e) === fit), fit };
}

/** Consecutive sessions for the whole step on one device, or null if they don't fit. */
function planOnDevice(
  step: PlanStepInput,
  equipment: Equipment,
  after: CalendarPoint,
  state: PlanningState,
): Candidate | null {
  const lab = state.labById.get(equipment.labId);
  if (!lab) return null;
  const sessions: TimeSlot[] = [];
  let cursor = after;
  for (const durationHours of splitHours(step.hours, equipment.maxHoursPerBooking)) {
    const slot = earliestSlot({
      equipment,
      lab,
      durationHours,
      after: cursor,
      deadline: state.input.deadline,
      calendar: state.calendar,
      userBusy: [...state.userBusy, ...sessions],
      horizonDays: state.horizonDays,
    });
    if (!slot) return null;
    sessions.push(slot);
    cursor = endOf(slot);
  }
  return { equipment, sessions, finish: cursor };
}

const comparePoints = (a: CalendarPoint, b: CalendarPoint) =>
  a.date.localeCompare(b.date) || a.hour - b.hour;

/** Earlier finish wins; then instant-booking devices (no approval wait); then id for determinism. */
function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    comparePoints(a.finish, b.finish) ||
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
