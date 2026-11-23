import type { ActivityEvent, BookingView, KioskView } from '@lablink/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { departments, equipment, labs, personas } from '../src/data/catalog.js';
import { fixedClock } from '../src/lib/clock.js';
import { MemoryBookingRepository } from '../src/repositories/memoryBookingRepository.js';
import { BookingService } from '../src/services/bookingService.js';
import { CatalogService } from '../src/services/catalogService.js';
import { CheckInService } from '../src/services/checkInService.js';
import { NOW, TODAY, bookingBody, buildTestApp, loginAs } from './helpers.js';

/** Today's code as the lab kiosk shows it (read by staff). */
async function kioskCode(app: Parameters<typeof request>[0], equipmentId: string) {
  const staff = await loginAs(app, 'a-ops');
  return ((await staff.get(`/api/equipment/${equipmentId}/kiosk`).expect(200)).body as KioskView)
    .code;
}

describe('lab kiosk', () => {
  it('shows staff a daily 6-character code and today’s sessions', async () => {
    const { app, services } = buildTestApp();
    const staff = await loginAs(app, 'f-nair');
    const { body } = (await staff.get('/api/equipment/dso-keysight/kiosk').expect(200)) as {
      body: KioskView;
    };
    expect(body.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(body.date).toBe(TODAY);
    expect(body.sessions.map((s) => s.id)).toContain('bk-seed-w1');
    // Codes rotate daily and differ per device.
    expect(services.checkIns.codeFor('dso-keysight', '2026-11-24')).not.toBe(body.code);
    expect(services.checkIns.codeFor('fpga-zedboard')).not.toBe(body.code);
  });

  it('is not available to students', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-priya');
    await student.get('/api/equipment/dso-keysight/kiosk').expect(403);
  });
});

describe('check-in', () => {
  it('checks the student into their current session with the kiosk code', async () => {
    const { app } = buildTestApp();
    const code = await kioskCode(app, 'dso-keysight');
    const student = await loginAs(app, 's-priya');
    const res = await student
      .post('/api/check-in')
      .send({ equipmentId: 'dso-keysight', code: code.toLowerCase() })
      .expect(200);
    expect((res.body as BookingView).checkedInAt).toBe(NOW);
    // Already checked in: nothing left to check in to.
    await student.post('/api/check-in').send({ equipmentId: 'dso-keysight', code }).expect(404);
  });

  it('rejects wrong codes, other devices and sessions outside the window', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-priya');
    await student
      .post('/api/check-in')
      .send({ equipmentId: 'dso-keysight', code: 'AAAAAA' })
      .expect(403);
    await student
      .post('/api/check-in')
      .send({ equipmentId: 'dso-keysight', code: 'bad' })
      .expect(400);
    const fpgaCode = await kioskCode(app, 'fpga-zedboard');
    await student
      .post('/api/check-in')
      .send({ equipmentId: 'fpga-zedboard', code: fpgaCode })
      .expect(404);
  });
});

describe('no-show release and backfill', () => {
  it('releases a missed session on the next read and backfills the queued request', async () => {
    const { app } = buildTestApp();
    await request(app).get('/api/catalog').expect(200); // any read triggers the lazy sweep

    const arjun = await loginAs(app, 's-arjun');
    const released = (
      (await arjun.get('/api/bookings/mine').expect(200)).body as BookingView[]
    ).find((b) => b.id === 'bk-seed-n1')!;
    expect(released).toMatchObject({ status: 'no-show', decision: { by: 'system' } });

    const rohan = await loginAs(app, 's-rohan');
    const backfilled = (
      (await rohan.get('/api/bookings/mine').expect(200)).body as BookingView[]
    ).find((b) => b.id === 'bk-seed-n2')!;
    expect(backfilled).toMatchObject({ status: 'approved', backfilledFrom: 'bk-seed-n1' });

    const admin = await loginAs(app, 'a-ops');
    const events = (await admin.get('/api/activity').expect(200)).body as ActivityEvent[];
    expect(events.map((e) => e.id)).toEqual(
      expect.arrayContaining(['bk-seed-n1:no-show', 'bk-seed-n2:backfilled', 'bk-seed-y1:no-show']),
    );
  });

  it('gives walk-up bookings a grace period instead of releasing them instantly', async () => {
    // 11:00 campus time; the 10–12 session was booked at 10:50, 35 minutes after it started.
    const clock = fixedClock(NOW, TODAY, 11);
    const bookedAt = new Date(Date.parse(NOW) - 10 * 60_000).toISOString();
    const catalog = new CatalogService({ departments, labs, equipment, personas });
    const project = {
      title: 'p',
      summary: 'a project summary for tests',
      deadline: '2026-12-20',
      requirements: [],
    };
    const repo = new MemoryBookingRepository([
      {
        id: 'walk-up',
        equipmentId: 'stm32-kit',
        userId: 's-zara',
        slot: { date: TODAY, startHour: 10, endHour: 12 },
        project,
        status: 'approved',
        createdAt: bookedAt,
      },
    ]);
    const service = new CheckInService(
      repo,
      catalog,
      new BookingService(repo, catalog, clock),
      clock,
      'x'.repeat(32),
      { warn: () => undefined },
    );
    expect(await service.sweep()).toBe(0);
    expect((await repo.get('walk-up'))?.status).toBe('approved');
  });

  it('does not auto-approve into approval-required equipment (faculty stay in the loop)', async () => {
    const clock = fixedClock(NOW, TODAY, 11);
    const catalog = new CatalogService({ departments, labs, equipment, personas });
    const project = {
      title: 'p',
      summary: 'a project summary for tests',
      deadline: '2026-12-20',
      requirements: [],
    };
    const repo = new MemoryBookingRepository([
      {
        id: 'late',
        equipmentId: 'laser-60w',
        userId: 's-arjun',
        slot: { date: TODAY, startHour: 10, endHour: 12 },
        project,
        status: 'approved',
        createdAt: '2026-11-20T00:00:00.000Z',
      },
      {
        id: 'waiting',
        equipmentId: 'laser-60w',
        userId: 's-zara',
        slot: { date: TODAY, startHour: 11, endHour: 12 },
        project,
        status: 'pending',
        createdAt: '2026-11-22T00:00:00.000Z',
      },
    ]);
    const service = new CheckInService(
      repo,
      catalog,
      new BookingService(repo, catalog, clock),
      clock,
      'x'.repeat(32),
      { warn: () => undefined },
    );
    expect(await service.sweep()).toBe(1);
    expect((await repo.get('late'))?.status).toBe('no-show');
    expect((await repo.get('waiting'))?.status).toBe('pending');
    // Idempotent: nothing left to release.
    expect(await service.sweep()).toBe(0);
  });

  it('gives a backfilled student their own grace period (regression)', async () => {
    // 10:30: Arjun missed his 9–11 session; Rohan's long-queued 10–12 request gets the slot.
    const clock = fixedClock(NOW, TODAY, 10, 30);
    const catalog = new CatalogService({ departments, labs, equipment, personas });
    const project = {
      title: 'p',
      summary: 'a project summary for tests',
      deadline: '2026-12-20',
      requirements: [],
    };
    const longAgo = '2026-11-20T00:00:00.000Z';
    const repo = new MemoryBookingRepository([
      {
        id: 'missed',
        equipmentId: 'vr-station',
        userId: 's-arjun',
        slot: { date: TODAY, startHour: 9, endHour: 11 },
        project,
        status: 'approved',
        createdAt: longAgo,
      },
      {
        id: 'queued',
        equipmentId: 'vr-station',
        userId: 's-rohan',
        slot: { date: TODAY, startHour: 10, endHour: 12 },
        project,
        status: 'pending',
        createdAt: longAgo,
      },
    ]);
    const service = new CheckInService(
      repo,
      catalog,
      new BookingService(repo, catalog, clock),
      clock,
      'x'.repeat(32),
      { warn: () => undefined },
    );
    await service.sweep();
    expect((await repo.get('queued'))?.status).toBe('approved');
    // A second sweep moments later must not release the student who just received the slot.
    await service.sweep();
    expect((await repo.get('queued'))?.status).toBe('approved');
  });

  it('refuses bookings for time that has already passed today', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-zara');
    const res = await student
      .post('/api/bookings')
      .send(bookingBody({ equipmentId: 'stm32-kit', date: TODAY, startHour: 9, endHour: 10 }))
      .expect(400);
    expect(res.body.error.message).toMatch(/already passed/);
  });
});
