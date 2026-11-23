import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatHour,
  isIsoDate,
  isWeekend,
  slotsOverlap,
  workingDays,
} from '../src/index.js';

describe('calendar helpers', () => {
  it('validates real ISO dates only', () => {
    expect(isIsoDate('2026-11-23')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('23-11-2026')).toBe(false);
  });

  it('does date arithmetic across month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(daysBetween('2026-11-23', '2026-12-03')).toBe(10);
    expect(daysBetween('2026-11-23', '2026-11-20')).toBe(-3);
  });

  it('skips weekends when listing working days', () => {
    expect(isWeekend('2026-11-28')).toBe(true); // Saturday
    expect(workingDays('2026-11-27', 3)).toEqual(['2026-11-27', '2026-11-30', '2026-12-01']);
  });

  it('detects overlapping slots on the same date only', () => {
    const a = { date: '2026-11-25', startHour: 10, endHour: 12 };
    expect(slotsOverlap(a, { date: '2026-11-25', startHour: 11, endHour: 13 })).toBe(true);
    expect(slotsOverlap(a, { date: '2026-11-25', startHour: 12, endHour: 13 })).toBe(false);
    expect(slotsOverlap(a, { date: '2026-11-26', startHour: 10, endHour: 12 })).toBe(false);
  });

  it('formats hours in 12-hour time', () => {
    expect(formatHour(9)).toBe('9AM');
    expect(formatHour(12)).toBe('12PM');
    expect(formatHour(17)).toBe('5PM');
  });
});
