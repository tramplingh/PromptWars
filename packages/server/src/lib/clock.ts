/** Abstracts "now" so business rules are deterministic under test. */
export interface Clock {
  /** Current instant as an ISO timestamp. */
  now(): string;
  /** Current campus-local calendar date, YYYY-MM-DD. */
  today(): string;
  /** Current campus-local hour, 0–23. */
  hour(): number;
}

export function systemClock(timeZone: string): Clock {
  // en-CA formats dates as YYYY-MM-DD.
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const hourFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  });
  return {
    now: () => new Date().toISOString(),
    today: () => dateFormatter.format(new Date()),
    hour: () => Number(hourFormatter.format(new Date())),
  };
}

export function fixedClock(nowIso: string, today: string, hour = 10): Clock {
  return { now: () => nowIso, today: () => today, hour: () => hour };
}
