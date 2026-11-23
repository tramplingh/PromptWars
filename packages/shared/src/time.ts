import type { TimeSlot } from './domain.js';

/**
 * Calendar helpers. Dates are handled as plain `YYYY-MM-DD` strings in campus
 * local time and all arithmetic is done in UTC to stay free of DST/timezone bugs.
 */

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  return toIsoDate(parseIsoDate(value)) === value;
}

export function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return toIsoDate(new Date(parseIsoDate(date).getTime() + days * MS_PER_DAY));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY);
}

export function isWeekend(date: string): boolean {
  const day = parseIsoDate(date).getUTCDay();
  return day === 0 || day === 6;
}

/** The next `count` working days (Mon–Fri) starting at `from`, inclusive. */
export function workingDays(from: string, count: number): string[] {
  const days: string[] = [];
  let cursor = from;
  while (days.length < count) {
    if (!isWeekend(cursor)) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function slotHours(slot: TimeSlot): number {
  return slot.endHour - slot.startHour;
}

export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a.date === b.date && a.startHour < b.endHour && b.startHour < a.endHour;
}

/** Orders slots chronologically; useful as an `Array#sort` comparator. */
export function compareSlots(a: TimeSlot, b: TimeSlot): number {
  return a.date.localeCompare(b.date) || a.startHour - b.startHour;
}

export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

export function formatSlot(slot: TimeSlot): string {
  const weekday = parseIsoDate(slot.date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${weekday}, ${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`;
}
