import type { ActivityEvent, ActivityType } from '@lablink/shared';

export const ACTIVITY_VERB: Record<ActivityType, string> = {
  requested: 'requested',
  confirmed: 'booked',
  approved: 'was approved for',
  declined: 'was declined for',
  reallocated: 'was fairly reallocated to',
  'checked-in': 'checked in to',
  'no-show': 'missed check-in — slot released on',
  backfilled: 'got a released slot on',
};

export const ACTIVITY_ACCENT: Record<ActivityType, string> = {
  requested: 'border-l-amber-500',
  confirmed: 'border-l-emerald-500',
  approved: 'border-l-emerald-500',
  declined: 'border-l-rose-500',
  reallocated: 'border-l-violet-500',
  'checked-in': 'border-l-teal-500',
  'no-show': 'border-l-rose-500',
  backfilled: 'border-l-violet-500',
};

/** One-line summary, e.g. "Priya Sharma requested CO₂ Laser Cutter (60 W)". */
export function activitySentence(event: ActivityEvent): string {
  return `${event.studentName} ${ACTIVITY_VERB[event.type]} ${event.equipmentName}`;
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
