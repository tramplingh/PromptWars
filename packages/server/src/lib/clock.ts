import type { CampusTime } from '@lablink/shared';

/** Abstracts "now" so business rules are deterministic under test. */
export interface Clock {
  /** Current instant as an ISO timestamp. */
  now(): string;
  /** Current campus-local calendar date, YYYY-MM-DD. */
  today(): string;
  /** Current campus-local hour, 0–23. */
  hour(): number;
  /** Campus-local date and minute-of-day of an instant (default: now). */
  campusTime(iso?: string): CampusTime;
}

/** Campus clock; `offsetMs` shifts "now" (CLOCK_OFFSET_HOURS, for demos outside lab hours). */
export function systemClock(timeZone: string, offsetMs = 0): Clock {
  const current = () => new Date(Date.now() + offsetMs);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const campusTime = (iso?: string): CampusTime => {
    const parts = Object.fromEntries(
      formatter.formatToParts(iso ? new Date(iso) : current()).map((p) => [p.type, p.value]),
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
  };
  return {
    now: () => current().toISOString(),
    today: () => campusTime().date,
    hour: () => Math.floor(campusTime().minutes / 60),
    campusTime,
  };
}

/**
 * Test clock frozen at `nowIso`, which corresponds to `today` at `hour`:00 campus
 * time. Other instants are converted with the same fixed offset.
 */
export function fixedClock(nowIso: string, today: string, hour = 10, minute = 0): Clock {
  const offsetMs =
    Date.parse(`${today}T00:00:00.000Z`) + (hour * 60 + minute) * 60_000 - Date.parse(nowIso);
  const campusTime = (iso?: string): CampusTime => {
    const local = new Date(Date.parse(iso ?? nowIso) + offsetMs).toISOString();
    return {
      date: local.slice(0, 10),
      minutes: Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)),
    };
  };
  return { now: () => nowIso, today: () => today, hour: () => hour, campusTime };
}
