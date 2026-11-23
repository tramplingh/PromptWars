import type { Booking } from './domain.js';

/**
 * Check-in and no-show rules. Pure functions over campus-local time so the
 * same logic drives the API, the lazy no-show sweep and the UI.
 */

/** Check-in opens this many minutes before a session starts. */
export const CHECK_IN_OPENS_BEFORE_MINUTES = 15;
/** A session with no check-in this long after it starts is released as a no-show. */
export const NO_SHOW_GRACE_MINUTES = 15;

/** A campus-local moment: calendar date plus minutes since midnight. */
export interface CampusTime {
  date: string;
  minutes: number;
}

export function checkInWindow(booking: Booking): { opens: number; closes: number } {
  return {
    opens: booking.slot.startHour * 60 - CHECK_IN_OPENS_BEFORE_MINUTES,
    closes: booking.slot.endHour * 60,
  };
}

export function canCheckIn(booking: Booking, now: CampusTime): boolean {
  if (booking.status !== 'approved' || booking.checkedInAt || booking.slot.date !== now.date)
    return false;
  const { opens, closes } = checkInWindow(booking);
  return now.minutes >= opens && now.minutes < closes;
}

/**
 * Minute of the session's day after which an un-checked-in booking is a
 * no-show. `grantedAt` is when the student actually got the slot (booked, or
 * approved / backfilled later); if that happened after the session began, the
 * grace period runs from then — nobody is released before they could arrive.
 */
export function noShowDeadline(booking: Booking, grantedAt: CampusTime): number {
  const fromStart = booking.slot.startHour * 60 + NO_SHOW_GRACE_MINUTES;
  const fromGrant =
    grantedAt.date === booking.slot.date ? grantedAt.minutes + NO_SHOW_GRACE_MINUTES : -Infinity;
  return Math.min(Math.max(fromStart, fromGrant), booking.slot.endHour * 60);
}

/** True when today's approved session passed its deadline without a check-in. */
export function isNoShow(booking: Booking, now: CampusTime, grantedAt: CampusTime): boolean {
  if (booking.status !== 'approved' || booking.checkedInAt || booking.slot.date !== now.date)
    return false;
  return now.minutes >= noShowDeadline(booking, grantedAt);
}

/** When the student got the slot: the later of creation and the approving decision. */
export function grantedAtIso(booking: Booking): string {
  const decided = booking.status === 'approved' ? booking.decision?.at : undefined;
  return decided && decided > booking.createdAt ? decided : booking.createdAt;
}
