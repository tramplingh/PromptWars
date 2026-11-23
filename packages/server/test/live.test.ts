import type { ActivityEvent, LiveStatus } from '@lablink/shared';
import { liveStatus } from '@lablink/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { equipment, labs } from '../src/data/catalog.js';
import { buildSeedBookings } from '../src/data/seedBookings.js';
import { NOW, TODAY, bookingBody, buildTestApp, loginAs } from './helpers.js';

const byId = (list: LiveStatus[], id: string) => list.find((s) => s.equipmentId === id)!;

describe('live equipment status', () => {
  const seed = buildSeedBookings(TODAY, NOW);
  const find = (id: string) => equipment.find((e) => e.id === id)!;
  const labOf = (id: string) => labs.find((l) => l.id === find(id).labId)!;

  it('reports in-use equipment and when it frees up', () => {
    // Seed: Zara holds one GPU 9–13 today; a second booking fills both units.
    const extra = { ...seed.find((b) => b.id === 'bk-seed-a2')!, id: 'x', userId: 's-rohan' };
    const status = liveStatus(find('gpu-4090'), labOf('gpu-4090'), [...seed, extra], TODAY, 10);
    expect(status).toEqual({
      equipmentId: 'gpu-4090',
      state: 'in-use',
      freeUnits: 0,
      freeFromHour: 13,
    });
  });

  it('counts free units, closed hours and maintenance', () => {
    expect(liveStatus(find('dso-keysight'), labOf('dso-keysight'), seed, TODAY, 10)).toMatchObject({
      state: 'available',
      freeUnits: 2,
    });
    expect(liveStatus(find('dso-keysight'), labOf('dso-keysight'), seed, TODAY, 7).state).toBe(
      'closed',
    );
    expect(
      liveStatus(find('dso-keysight'), labOf('dso-keysight'), seed, '2026-11-28', 10).state,
    ).toBe('closed');
    expect(liveStatus(find('utm-instron'), labOf('utm-instron'), seed, TODAY, 10).state).toBe(
      'maintenance',
    );
  });

  it('exposes status for the whole catalogue over HTTP', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/equipment/status').expect(200);
    expect(res.body).toHaveLength(equipment.length);
    expect(byId(res.body, 'dso-keysight')).toMatchObject({ state: 'available', freeUnits: 2 });
    expect(byId(res.body, 'utm-instron').state).toBe('maintenance');
  });
});

describe('activity feed', () => {
  it('shows students only their own activity', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-priya');
    const res = await student.get('/api/activity').expect(200);
    const events = res.body as ActivityEvent[];
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.studentName === 'Priya Sharma')).toBe(true);
  });

  it('scopes faculty to their department and reports reallocations', async () => {
    const { app } = buildTestApp();
    const faculty = await loginAs(app, 'f-rao');
    await faculty.post(`/api/conflicts/laser-60w_${'2026-11-25'}_10-13/apply`).send({}).expect(200);
    const events = (await faculty.get('/api/activity').expect(200)).body as ActivityEvent[];
    const mech = new Set(equipment.filter((e) => e.departmentId === 'mech').map((e) => e.id));
    const otherDept = events.filter((e) => !mech.has(e.equipmentId));
    // Only the booking moved to the Design studio's cutter may appear from outside MECH.
    expect(otherDept.every((e) => e.equipmentId === 'laser-40w')).toBe(true);
    expect(events.filter((e) => e.type === 'reallocated')).toHaveLength(2);
    // Newest first.
    expect(events.map((e) => e.at)).toEqual([...events.map((e) => e.at)].sort().reverse());
  });

  it('labels instant bookings as confirmed', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    await student.post('/api/bookings').send(bookingBody()).expect(201);
    const events = (await student.get('/api/activity').expect(200)).body as ActivityEvent[];
    expect(events[0]).toMatchObject({ type: 'confirmed', equipmentId: 'dso-keysight' });
  });

  it('requires a profile', async () => {
    const { app } = buildTestApp();
    await request(app).get('/api/activity').expect(401);
  });
});
