import { describe, expect, it } from 'vitest';
import {
  computeAvailability,
  findFreeSlots,
  hasCapacity,
  withinOpeningHours,
} from '../src/index.js';
import { lab, makeBooking, makeEquipment } from './fixtures.js';

describe('capacity', () => {
  const twoUnits = makeEquipment({ units: 2 });

  it('allows bookings until every unit is taken in an hour', () => {
    const one = [makeBooking({ status: 'approved' })];
    const two = [...one, makeBooking({ status: 'approved', slot: { startHour: 11, endHour: 13 } })];
    expect(hasCapacity(twoUnits, one, { date: '2026-11-25', startHour: 10, endHour: 12 })).toBe(
      true,
    );
    expect(hasCapacity(twoUnits, two, { date: '2026-11-25', startHour: 11, endHour: 12 })).toBe(
      false,
    );
    expect(hasCapacity(twoUnits, two, { date: '2026-11-25', startHour: 13, endHour: 14 })).toBe(
      true,
    );
  });

  it('ignores cancelled and rejected bookings', () => {
    const inactive = [makeBooking({ status: 'cancelled' }), makeBooking({ status: 'rejected' })];
    expect(
      hasCapacity(makeEquipment(), inactive, { date: '2026-11-25', startHour: 10, endHour: 12 }),
    ).toBe(true);
  });

  it('enforces lab opening hours', () => {
    expect(withinOpeningHours(lab, { date: '2026-11-25', startHour: 8, endHour: 10 })).toBe(false);
    expect(withinOpeningHours(lab, { date: '2026-11-25', startHour: 15, endHour: 17 })).toBe(true);
  });
});

describe('computeAvailability', () => {
  it('reports approved, pending and free units per hour for working days', () => {
    const equipment = makeEquipment({ units: 2 });
    const days = computeAvailability(
      equipment,
      lab,
      [makeBooking({ status: 'approved' }), makeBooking({ status: 'pending' })],
      '2026-11-25',
      2,
    );
    expect(days.map((d) => d.date)).toEqual(['2026-11-25', '2026-11-26']);
    const tenAm = days[0]!.hours.find((h) => h.hour === 10)!;
    expect(tenAm).toEqual({ hour: 10, approved: 1, pending: 1, free: 0 });
    expect(days[0]!.hours).toHaveLength(lab.closeHour - lab.openHour);
  });
});

describe('findFreeSlots', () => {
  it('returns slots closest to the preferred time before the deadline', () => {
    const equipment = makeEquipment();
    const taken = [makeBooking({ status: 'approved', slot: { startHour: 9, endHour: 13 } })];
    const slots = findFreeSlots({
      equipment,
      lab,
      bookings: taken,
      from: '2026-11-25',
      days: 3,
      durationHours: 2,
      latestDate: '2026-11-25',
      near: { date: '2026-11-25', startHour: 10, endHour: 12 },
    });
    expect(slots[0]).toEqual({ date: '2026-11-25', startHour: 13, endHour: 15 });
    expect(slots.every((s) => s.date === '2026-11-25')).toBe(true);
  });

  it('returns nothing for equipment under maintenance', () => {
    const slots = findFreeSlots({
      equipment: makeEquipment({ status: 'maintenance' }),
      lab,
      bookings: [],
      from: '2026-11-25',
      days: 2,
      durationHours: 1,
    });
    expect(slots).toEqual([]);
  });
});
