/** Abstracts "now" so business rules are deterministic under test. */
export interface Clock {
  /** Current instant as an ISO timestamp. */
  now(): string;
  /** Current campus-local calendar date, YYYY-MM-DD. */
  today(): string;
}

export function systemClock(timeZone: string): Clock {
  // en-CA formats dates as YYYY-MM-DD.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return {
    now: () => new Date().toISOString(),
    today: () => formatter.format(new Date()),
  };
}

export function fixedClock(nowIso: string, today: string): Clock {
  return { now: () => nowIso, today: () => today };
}
