import { describe, expect, it } from 'vitest';
import { canCheckIn, computeUsageHours, isNoShow, noShowDeadline } from '../src/index.js';
import { makeBooking } from './fixtures.js';

const today = '2026-11-25';
const at = (h: number, m = 0) => ({ date: today, minutes: h * 60 + m });
const approved = makeBooking({
  status: 'approved',
  slot: { date: today, startHour: 10, endHour: 12 },
});
const createdEarly = { date: '2026-11-20', minutes: 600 };

describe('check-in window', () => {
  it('opens 15 minutes before the start and closes at the end', () => {
    expect(canCheckIn(approved, at(9, 44))).toBe(false);
    expect(canCheckIn(approved, at(9, 45))).toBe(true);
    expect(canCheckIn(approved, at(11, 59))).toBe(true);
    expect(canCheckIn(approved, at(12, 0))).toBe(false);
  });

  it('is only for approved, not-yet-checked-in sessions today', () => {
    expect(canCheckIn({ ...approved, status: 'pending' }, at(10))).toBe(false);
    expect(canCheckIn({ ...approved, checkedInAt: 'x' }, at(10))).toBe(false);
    expect(canCheckIn(approved, { date: '2026-11-26', minutes: 600 })).toBe(false);
  });
});

describe('no-show detection', () => {
  it('fires 15 minutes after the start without a check-in', () => {
    expect(isNoShow(approved, at(10, 14), createdEarly)).toBe(false);
    expect(isNoShow(approved, at(10, 15), createdEarly)).toBe(true);
    expect(isNoShow({ ...approved, checkedInAt: 'x' }, at(11), createdEarly)).toBe(false);
  });

  it('gives walk-up bookings a grace period from when they were made', () => {
    const madeLate = at(10, 40);
    expect(noShowDeadline(approved, madeLate)).toBe(10 * 60 + 55);
    expect(isNoShow(approved, at(10, 50), madeLate)).toBe(false);
    expect(isNoShow(approved, at(10, 55), madeLate)).toBe(true);
  });

  it('never extends past the end of the session', () => {
    expect(noShowDeadline(approved, at(11, 58))).toBe(12 * 60);
  });

  it('counts no-show hours against the student’s fair share', () => {
    const usage = computeUsageHours([{ ...approved, userId: 'u', status: 'no-show' }], today);
    expect(usage).toEqual({ u: 2 });
  });
});
