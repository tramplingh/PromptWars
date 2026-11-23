import { describe, expect, it } from 'vitest';
import {
  capabilityFit,
  computeUsageHours,
  detectConflicts,
  resolveConflict,
  scoreRequest,
  type ScoringContext,
} from '../src/index.js';
import { lab, makeBooking, makeEquipment, otherLab } from './fixtures.js';

const today = '2026-11-23';
const now = '2026-11-23T12:00:00.000Z';
const laser = makeEquipment();
const ctx: ScoringContext = { today, now, equipment: laser, usageHours: {} };

describe('scoreRequest', () => {
  it('gives closer deadlines higher urgency', () => {
    const soon = scoreRequest(makeBooking({ project: { deadline: '2026-11-26' } }), ctx);
    const later = scoreRequest(makeBooking({ project: { deadline: '2026-12-20' } }), ctx);
    expect(soon.breakdown.urgency).toBeGreaterThan(later.breakdown.urgency);
    expect(soon.total).toBeGreaterThan(later.total);
  });

  it('lowers priority for students who already used a lot of lab time', () => {
    const booking = makeBooking({ userId: 'heavy' });
    const fresh = scoreRequest(booking, ctx);
    const heavy = scoreRequest(booking, { ...ctx, usageHours: { heavy: 15 } });
    expect(heavy.breakdown.fairness).toBe(0.25);
    expect(heavy.total).toBeLessThan(fresh.total);
  });

  it('marks requests after the deadline as infeasible', () => {
    const score = scoreRequest(
      makeBooking({ slot: { date: '2026-11-27' }, project: { deadline: '2026-11-26' } }),
      ctx,
    );
    expect(score.feasible).toBe(false);
    expect(score.reasons).toContain('Requested slot is after the project deadline');
  });

  it('keeps every factor within 0..1 and total within 0..100', () => {
    const score = scoreRequest(
      makeBooking({ createdAt: '2020-01-01T00:00:00.000Z', project: { deadline: '2026-11-20' } }),
      ctx,
    );
    for (const value of Object.values(score.breakdown)) expect(value).toBeGreaterThanOrEqual(0);
    for (const value of Object.values(score.breakdown)) expect(value).toBeLessThanOrEqual(1);
    expect(score.total).toBeLessThanOrEqual(100);
  });
});

describe('capabilityFit & usage', () => {
  it('measures the share of required capabilities provided', () => {
    expect(capabilityFit(['laser-cutting', 'cnc'], laser)).toBe(0.5);
    expect(capabilityFit([], laser)).toBe(1);
    expect(capabilityFit(['LASER-CUTTING'], laser)).toBe(1);
  });

  it('counts only approved hours inside the fairness window', () => {
    const usage = computeUsageHours(
      [
        makeBooking({
          userId: 'a',
          status: 'approved',
          slot: { date: '2026-11-20', startHour: 9, endHour: 12 },
        }),
        makeBooking({
          userId: 'a',
          status: 'approved',
          slot: { date: '2026-10-01', startHour: 9, endHour: 12 },
        }),
        makeBooking({ userId: 'a', status: 'pending' }),
      ],
      today,
    );
    expect(usage).toEqual({ a: 3 });
  });
});

describe('detectConflicts', () => {
  it('groups overlapping requests that exceed capacity', () => {
    const bookings = [
      makeBooking({ slot: { startHour: 10, endHour: 12 } }),
      makeBooking({ slot: { startHour: 11, endHour: 13 } }),
      makeBooking({ slot: { startHour: 15, endHour: 16 } }),
    ];
    const conflicts = detectConflicts(laser, bookings);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      id: 'laser_2026-11-25_10-13',
      startHour: 10,
      endHour: 13,
    });
    expect(conflicts[0]!.pendingIds).toHaveLength(2);
  });

  it('ignores overlaps that fit within the unit count', () => {
    const bookings = [makeBooking(), makeBooking()];
    expect(detectConflicts(makeEquipment({ units: 2 }), bookings)).toEqual([]);
  });

  it('ignores clusters made only of approved bookings', () => {
    expect(
      detectConflicts(laser, [
        makeBooking({ status: 'approved' }),
        makeBooking({ status: 'approved' }),
      ]),
    ).toEqual([]);
  });
});

describe('resolveConflict', () => {
  const backup = makeEquipment({ id: 'laser-b', labId: otherLab.id, departmentId: 'd2' });

  it('allocates the highest priority request and moves others to fair alternatives', () => {
    const urgent = makeBooking({ userId: 'urgent', project: { deadline: '2026-11-26' } });
    const relaxed = makeBooking({ userId: 'relaxed', project: { deadline: '2026-12-20' } });
    const bookings = [urgent, relaxed];
    const [conflict] = detectConflicts(laser, bookings);

    const plan = resolveConflict({
      conflict: conflict!,
      bookings,
      equipment: [laser, backup],
      labs: [lab, otherLab],
      today,
      now,
    });

    expect(plan.decisions.map((d) => [d.userId, d.outcome])).toEqual([
      ['urgent', 'allocate'],
      ['relaxed', 'reassign'],
    ]);
    expect(plan.decisions[1]!.alternatives[0]).toEqual({
      kind: 'equivalent-same-time',
      equipmentId: 'laser-b',
      slot: relaxed.slot,
    });
    expect(plan.summary).toMatch(/1 request keeps Laser Cutter, 1 moved/);
  });

  it('does not offer the same alternative to two displaced students', () => {
    const bookings = [
      makeBooking({ userId: 'a', project: { deadline: '2026-11-25' } }),
      makeBooking({ userId: 'b', project: { deadline: '2026-11-30' } }),
      makeBooking({ userId: 'c', project: { deadline: '2026-12-15' } }),
    ];
    const [conflict] = detectConflicts(laser, bookings);
    const plan = resolveConflict({
      conflict: conflict!,
      bookings,
      equipment: [laser, backup],
      labs: [lab, otherLab],
      today,
      now,
    });
    const moves = plan.decisions
      .filter((d) => d.outcome === 'reassign')
      .map((d) => d.alternatives[0]);
    expect(moves).toHaveLength(2);
    expect(moves[0]).not.toEqual(moves[1]);
  });

  it('is deterministic for identical input', () => {
    const bookings = [makeBooking(), makeBooking()];
    const [conflict] = detectConflicts(laser, bookings);
    const input = { conflict: conflict!, bookings, equipment: [laser], labs: [lab], today, now };
    expect(resolveConflict(input)).toEqual(resolveConflict(input));
  });

  it('never suggests a slot after the student deadline', () => {
    const bookings = [
      makeBooking({ userId: 'a', project: { deadline: '2026-11-25' } }),
      makeBooking({ userId: 'b', project: { deadline: '2026-11-25' } }),
    ];
    const [conflict] = detectConflicts(laser, bookings);
    const plan = resolveConflict({
      conflict: conflict!,
      bookings,
      equipment: [laser],
      labs: [lab],
      today,
      now,
    });
    for (const d of plan.decisions)
      for (const alt of d.alternatives) expect(alt.slot.date <= '2026-11-25').toBe(true);
  });
});
