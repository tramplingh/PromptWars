import { describe, expect, it } from 'vitest';
import {
  orderSteps,
  scheduleProject,
  splitHours,
  type PlanStepInput,
  type ScheduleInput,
} from '../src/index.js';
import { lab, makeBooking, makeEquipment, otherLab } from './fixtures.js';

const mill = makeEquipment({
  id: 'mill',
  capabilities: ['pcb-milling'],
  maxHoursPerBooking: 2,
  requiresApproval: false,
});
const scope = makeEquipment({
  id: 'scope',
  capabilities: ['oscilloscope'],
  units: 1,
  maxHoursPerBooking: 3,
  labId: otherLab.id,
  requiresApproval: false,
});
const laser = makeEquipment({
  id: 'laser',
  capabilities: ['laser-cutting'],
  maxHoursPerBooking: 3,
});

const step = (
  id: string,
  requirements: string[],
  hours: number,
  dependsOn: string[] = [],
): PlanStepInput => ({
  id,
  title: id,
  requirements,
  hours,
  dependsOn,
});

const base = (overrides: Partial<ScheduleInput> = {}): ScheduleInput => ({
  steps: [
    step('pcb', ['pcb-milling'], 2),
    step('debug', ['oscilloscope'], 2, ['pcb']),
    step('frame', ['laser-cutting'], 3, ['debug']),
  ],
  deadline: '2026-12-04',
  from: { date: '2026-11-25', hour: 9 },
  equipment: [mill, scope, laser],
  labs: [lab, otherLab],
  bookings: [],
  userId: 'me',
  ...overrides,
});

describe('orderSteps', () => {
  it('puts prerequisites first and rejects cycles', () => {
    const ordered = orderSteps([step('b', [], 1, ['a']), step('a', [], 1)]);
    expect(ordered.map((s) => s.id)).toEqual(['a', 'b']);
    expect(() => orderSteps([step('a', [], 1, ['b']), step('b', [], 1, ['a'])])).toThrow(
      /circular/,
    );
  });

  it('ignores unknown and self dependencies', () => {
    expect(orderSteps([step('a', [], 1, ['ghost', 'a'])]).map((s) => s.id)).toEqual(['a']);
  });
});

describe('splitHours', () => {
  it('splits long work into sessions the device allows', () => {
    expect(splitHours(5, 2)).toEqual([2, 2, 1]);
    expect(splitHours(0.4, 3)).toEqual([1]);
  });
});

describe('scheduleProject', () => {
  it('chains steps in dependency order without overlaps', () => {
    const result = scheduleProject(base());
    expect(result.feasible).toBe(true);
    const [pcb, debug, frame] = result.steps;
    expect(pcb).toMatchObject({
      status: 'scheduled',
      equipmentId: 'mill',
      sessions: [{ date: '2026-11-25', startHour: 9, endHour: 11 }],
    });
    expect(debug).toMatchObject({
      status: 'scheduled',
      equipmentId: 'scope',
      sessions: [{ date: '2026-11-25', startHour: 11, endHour: 13 }],
    });
    expect(frame).toMatchObject({
      status: 'scheduled',
      equipmentId: 'laser',
      sessions: [{ date: '2026-11-25', startHour: 13, endHour: 16 }],
    });
    expect(result.finish).toEqual({ date: '2026-11-25', hour: 16 });
  });

  it('works around existing bookings and the student’s own commitments', () => {
    const result = scheduleProject(
      base({
        bookings: [
          makeBooking({
            equipmentId: 'mill',
            status: 'approved',
            slot: { date: '2026-11-25', startHour: 9, endHour: 12 },
          }),
          makeBooking({
            equipmentId: 'other',
            userId: 'me',
            status: 'approved',
            slot: { date: '2026-11-25', startHour: 12, endHour: 14 },
          }),
        ],
      }),
    );
    const [pcb, debug] = result.steps;
    expect(pcb).toMatchObject({ sessions: [{ startHour: 14, endHour: 16 }] });
    // Labs close at 5PM, so the 2-hour debug session rolls to the next morning.
    expect(debug).toMatchObject({ sessions: [{ date: '2026-11-26', startHour: 9, endHour: 11 }] });
  });

  it('splits a long step into consecutive sessions', () => {
    const result = scheduleProject(base({ steps: [step('pcb', ['pcb-milling'], 5)] }));
    expect(result.steps[0]).toMatchObject({
      sessions: [
        { startHour: 9, endHour: 11 },
        { startHour: 11, endHour: 13 },
        { startHour: 13, endHour: 14 },
      ],
    });
  });

  it('prefers the device that finishes earliest, then instant booking', () => {
    const busyLaser = makeBooking({
      equipmentId: 'laser',
      status: 'approved',
      slot: { date: '2026-11-25', startHour: 9, endHour: 17 },
    });
    const spare = makeEquipment({
      id: 'laser-2',
      capabilities: ['laser-cutting'],
      labId: otherLab.id,
      requiresApproval: false,
    });
    const result = scheduleProject(
      base({
        steps: [step('frame', ['laser-cutting'], 2)],
        equipment: [laser, spare],
        bookings: [busyLaser],
      }),
    );
    expect(result.steps[0]).toMatchObject({ equipmentId: 'laser-2' });
  });

  it('never schedules past the deadline and explains why', () => {
    const result = scheduleProject(
      base({ deadline: '2026-11-25', from: { date: '2026-11-25', hour: 15 } }),
    );
    expect(result.feasible).toBe(false);
    expect(result.steps.some((s) => s.status === 'unschedulable')).toBe(true);
    for (const s of result.steps)
      if (s.status === 'scheduled')
        for (const slot of s.sessions) expect(slot.date <= '2026-11-25').toBe(true);
    // A step whose prerequisite failed is reported, not silently scheduled.
    expect(result.steps.at(-1)).toMatchObject({ status: 'unschedulable' });
  });

  it('reports capabilities nobody offers', () => {
    const result = scheduleProject(base({ steps: [step('x', ['teleportation'], 1)] }));
    expect(result.steps[0]).toMatchObject({
      status: 'unschedulable',
      reason: expect.stringMatching(/No operational equipment/),
    });
  });

  it('is deterministic', () => {
    expect(scheduleProject(base())).toEqual(scheduleProject(base()));
  });
});

describe('primary capability', () => {
  it('only assigns a step to devices offering its primary capability', () => {
    const printer = makeEquipment({
      id: 'printer',
      capabilities: ['3d-printing', 'high-precision'],
      requiresApproval: false,
    });
    const result = scheduleProject(
      base({
        steps: [step('pcb', ['pcb-milling', 'high-precision'], 2)],
        equipment: [printer, mill],
      }),
    );
    expect(result.steps[0]).toMatchObject({ status: 'scheduled', equipmentId: 'mill' });
  });
});
