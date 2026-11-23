import type { Booking, Equipment, Lab } from '../src/index.js';

export const lab: Lab = {
  id: 'lab-1',
  name: 'Lab',
  departmentId: 'd1',
  location: 'Room 1',
  openHour: 9,
  closeHour: 17,
};
export const otherLab: Lab = { ...lab, id: 'lab-2', departmentId: 'd2' };

export function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'laser',
    name: 'Laser Cutter',
    category: 'Fabrication',
    labId: lab.id,
    departmentId: 'd1',
    description: 'Cuts things',
    capabilities: ['laser-cutting', 'engraving'],
    units: 1,
    requiresApproval: true,
    status: 'operational',
    maxHoursPerBooking: 3,
    ...overrides,
  };
}

let counter = 0;
type BookingOverrides = Partial<Omit<Booking, 'slot' | 'project'>> & {
  slot?: Partial<Booking['slot']>;
  project?: Partial<Booking['project']>;
};

export function makeBooking(overrides: BookingOverrides = {}): Booking {
  counter++;
  const { slot, project, ...rest } = overrides;
  return {
    id: `b${counter}`,
    equipmentId: 'laser',
    userId: `u${counter}`,
    status: 'pending',
    createdAt: '2026-11-23T00:00:00.000Z',
    ...rest,
    slot: { date: '2026-11-25', startHour: 10, endHour: 12, ...slot },
    project: {
      title: 'Project',
      summary: 'A sufficiently long summary',
      deadline: '2026-12-10',
      requirements: ['laser-cutting'],
      ...project,
    },
  };
}
