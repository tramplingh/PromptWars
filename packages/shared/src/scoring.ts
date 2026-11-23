import type { Booking, Equipment } from './domain.js';
import { addDays, daysBetween, slotHours } from './time.js';

/**
 * Transparent priority scoring for contending requests. Four factors, each
 * normalised to 0–1 and weighted; the reasons array explains every factor in
 * plain language for students and faculty.
 */

export const SCORE_WEIGHTS = { urgency: 0.4, fairness: 0.25, fit: 0.2, waiting: 0.15 } as const;

/** Deadlines further away than this contribute zero urgency. */
export const URGENCY_HORIZON_DAYS = 30;
/** Approved hours at which a student's fairness factor bottoms out. */
export const FAIRNESS_CAP_HOURS = 20;
/** Look-back window for counting a student's recent usage. */
export const FAIRNESS_WINDOW_DAYS = 14;
/** Waiting time at which the waiting factor saturates. */
export const WAITING_CAP_HOURS = 72;

export type ScoreFactor = keyof typeof SCORE_WEIGHTS;
export type ScoreBreakdown = Record<ScoreFactor, number>;

export interface PriorityScore {
  /** 0–100, higher wins. */
  total: number;
  breakdown: ScoreBreakdown;
  /** False when the requested slot falls after the project deadline. */
  feasible: boolean;
  reasons: string[];
}

export interface ScoringContext {
  /** Campus-local ISO date. */
  today: string;
  /** ISO timestamp used to measure waiting time. */
  now: string;
  equipment: Equipment;
  /** Recently approved hours per user, from {@link computeUsageHours}. */
  usageHours: Readonly<Record<string, number>>;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
const normalise = (tag: string) => tag.trim().toLowerCase();

/** Share of required capabilities that the equipment provides (1 when none are required). */
export function capabilityFit(requirements: readonly string[], equipment: Equipment): number {
  const required = new Set(requirements.map(normalise));
  if (required.size === 0) return 1;
  const offered = new Set(equipment.capabilities.map(normalise));
  let matched = 0;
  for (const tag of required) if (offered.has(tag)) matched++;
  return matched / required.size;
}

/** Approved (and no-show) hours per user from `today - FAIRNESS_WINDOW_DAYS` onwards (upcoming included). */
export function computeUsageHours(
  bookings: readonly Booking[],
  today: string,
): Record<string, number> {
  const since = addDays(today, -FAIRNESS_WINDOW_DAYS);
  const usage: Record<string, number> = {};
  for (const b of bookings) {
    // No-shows still count: the slot was held and denied to others.
    if ((b.status !== 'approved' && b.status !== 'no-show') || b.slot.date < since) continue;
    usage[b.userId] = (usage[b.userId] ?? 0) + slotHours(b.slot);
  }
  return usage;
}

export function scoreRequest(booking: Booking, ctx: ScoringContext): PriorityScore {
  const daysToDeadline = daysBetween(ctx.today, booking.project.deadline);
  const usage = ctx.usageHours[booking.userId] ?? 0;
  const fit = capabilityFit(booking.project.requirements, ctx.equipment);
  const waitingHours = Math.max(
    0,
    (Date.parse(ctx.now) - Date.parse(booking.createdAt)) / 3_600_000,
  );

  const breakdown: ScoreBreakdown = {
    urgency: round2(clamp01(1 - daysToDeadline / URGENCY_HORIZON_DAYS)),
    fairness: round2(1 - clamp01(usage / FAIRNESS_CAP_HOURS)),
    fit: round2(fit),
    waiting: round2(clamp01(waitingHours / WAITING_CAP_HOURS)),
  };
  const weighted = (Object.keys(SCORE_WEIGHTS) as ScoreFactor[]).reduce(
    (sum, factor) => sum + SCORE_WEIGHTS[factor] * breakdown[factor],
    0,
  );
  const feasible = booking.slot.date <= booking.project.deadline;

  const required = booking.project.requirements.length;
  const reasons = [
    daysToDeadline < 0
      ? 'Project deadline has already passed'
      : `Deadline in ${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'}`,
    `${usage}h of approved lab time in the last ${FAIRNESS_WINDOW_DAYS} days`,
    required === 0
      ? 'No specific capabilities required'
      : `Equipment meets ${Math.round(fit * required)}/${required} required capabilities`,
    `Waiting ${Math.round(waitingHours)}h for a decision`,
  ];
  if (!feasible) reasons.push('Requested slot is after the project deadline');

  return { total: Math.round(weighted * 100), breakdown, feasible, reasons };
}

/** Orders requests by priority: feasible first, then score, then first-come-first-served. */
export function comparePriority(
  a: { booking: Booking; score: PriorityScore },
  b: { booking: Booking; score: PriorityScore },
): number {
  return (
    Number(b.score.feasible) - Number(a.score.feasible) ||
    b.score.total - a.score.total ||
    a.booking.createdAt.localeCompare(b.booking.createdAt) ||
    a.booking.id.localeCompare(b.booking.id)
  );
}
