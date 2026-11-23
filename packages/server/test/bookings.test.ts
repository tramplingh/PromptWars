import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DAYS, bookingBody, buildTestApp, loginAs } from './helpers.js';

describe('booking flow', () => {
  it('instantly confirms a free slot on equipment that needs no approval', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    const res = await student.post('/api/bookings').send(bookingBody()).expect(201);
    expect(res.body.outcome).toBe('confirmed');
    expect(res.body.booking).toMatchObject({
      status: 'approved',
      userId: 's-zara',
      equipmentName: expect.stringContaining('Oscilloscope'),
    });

    const mine = await student.get('/api/bookings/mine').expect(200);
    expect(mine.body.some((b: { id: string }) => b.id === res.body.booking.id)).toBe(true);
  });

  it('routes approval-required equipment to faculty as pending', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    const res = await student
      .post('/api/bookings')
      .send({
        ...bookingBody({ equipmentId: 'spectrum-rigol' }),
        project: { ...bookingBody().project, requirements: ['rf'] },
      })
      .expect(201);
    expect(res.body.outcome).toBe('awaiting-approval');
    expect(res.body.booking.status).toBe('pending');
  });

  it('queues a request that overlaps other pending requests for fair resolution', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    // The seeded laser-cutter conflict sits on DAYS[2] 10–13.
    const res = await student
      .post('/api/bookings')
      .send({
        ...bookingBody({ equipmentId: 'laser-60w', date: DAYS[2], startHour: 12, endHour: 13 }),
        project: { ...bookingBody().project, requirements: ['laser-cutting'] },
      })
      .expect(201);
    expect(res.body.outcome).toBe('queued-for-resolution');
  });

  it('rejects a slot that is already taken and suggests alternatives', async () => {
    const { app } = buildTestApp();
    const first = await loginAs(app, 's-zara');
    const body = bookingBody({ equipmentId: 'vr-station' });
    await first.post('/api/bookings').send(body).expect(201);

    const second = await loginAs(app, 's-arjun');
    const res = await second.post('/api/bookings').send(body).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details.alternatives.length).toBeGreaterThan(0);
  });

  it('prevents a student from double-booking themselves', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    await student.post('/api/bookings').send(bookingBody()).expect(201);
    const res = await student
      .post('/api/bookings')
      .send(bookingBody({ equipmentId: 'fpga-zedboard' }))
      .expect(409);
    expect(res.body.error.message).toMatch(/already have a booking at this time/);
  });

  it.each([
    ['in the past', { date: '2026-11-20' }, /today onwards/],
    ['on a weekend', { date: '2026-11-28' }, /weekends/],
    ['outside opening hours', { startHour: 7, endHour: 9 }, /opening hours/],
    ['longer than allowed', { startHour: 9, endHour: 14 }, /at most 3h/],
    ['after the deadline', { deadline: '2026-11-24' }, /deadline/],
  ])('rejects a booking %s', async (_label, overrides, message) => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    const res = await student.post('/api/bookings').send(bookingBody(overrides)).expect(400);
    expect(res.body.error.message).toMatch(message);
  });

  it('refuses equipment under maintenance', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    await student
      .post('/api/bookings')
      .send(bookingBody({ equipmentId: 'utm-instron' }))
      .expect(409);
  });

  it('lets students cancel only their own bookings', async () => {
    const { app } = buildTestApp();
    const owner = await loginAs(app, 's-zara');
    const created = await owner.post('/api/bookings').send(bookingBody()).expect(201);
    const id = created.body.booking.id as string;

    const intruder = await loginAs(app, 's-arjun');
    await intruder.post(`/api/bookings/${id}/cancel`).send({}).expect(403);

    const res = await owner.post(`/api/bookings/${id}/cancel`).send({}).expect(200);
    expect(res.body.status).toBe('cancelled');
  });

  it('only allows students to create bookings', async () => {
    const { app } = buildTestApp();
    const faculty = await loginAs(app, 'f-rao');
    await faculty.post('/api/bookings').send(bookingBody()).expect(403);
  });

  it('returns hourly availability for equipment', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/equipment/dso-keysight').expect(200);
    expect(res.body.availability).toHaveLength(5);
    expect(res.body.availability[0].date).toBe(DAYS[0]);
    const tenAm = res.body.availability[0].hours.find((h: { hour: number }) => h.hour === 10);
    expect(tenAm).toMatchObject({ approved: 1, free: 2 });
  });
});
