import { parseIsoDate } from '@lablink/shared';
import { now as clockNow, nowMs } from './clock';

/** Today's date in the browser's local timezone as YYYY-MM-DD. */
export function localToday(): string {
  const now = clockNow();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function weekdayLabel(date: string): string {
  return parseIsoDate(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function longDate(date: string): string {
  return parseIsoDate(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function relativeTime(iso: string): string {
  const minutes = Math.round((nowMs() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp. */
export function localDateOf(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Splits dates into Today / This week / Older (past-facing, e.g. request times)
 * or Today / This week / Later (future-facing, e.g. slot dates) — 7-day windows.
 */
export function splitByRecency(dates: string[], direction: 'past' | 'future') {
  const today = localToday();
  const dayMs = 86_400_000;
  const diff = (date: string) =>
    Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / dayMs);
  let todayCount = 0;
  let week = 0;
  let rest = 0;
  for (const date of dates) {
    const d = direction === 'past' ? -diff(date) : diff(date);
    if (d <= 0) todayCount++;
    else if (d < 7) week++;
    else rest++;
  }
  return [
    { label: 'Today', value: todayCount },
    { label: 'This week', value: week },
    { label: direction === 'past' ? 'Older' : 'Later', value: rest },
  ];
}

export function greeting(): string {
  const hour = clockNow().getHours();
  if (hour < 12) return 'Good morning';
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** The browser's current date and minute-of-day, in the shape the shared check-in rules use. */
export function localCampusTime(now = clockNow()): { date: string; minutes: number } {
  return { date: localDateOf(now.toISOString()), minutes: now.getHours() * 60 + now.getMinutes() };
}
