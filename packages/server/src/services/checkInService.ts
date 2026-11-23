import {
  canCheckIn,
  computeUsageHours,
  grantedAtIso,
  hasCapacity,
  isNoShow,
  scoreRequest,
  slotsOverlap,
  type Booking,
  type BookingView,
  type KioskView,
  type Persona,
} from '@lablink/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Clock } from '../lib/clock.js';
import { forbidden, notFound } from '../lib/errors.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { BookingService } from './bookingService.js';
import type { CatalogService } from './catalogService.js';

/** Code alphabet without look-alike characters (no 0/O, 1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
/** Minimum time between lazy sweeps on one instance. */
const SWEEP_INTERVAL_MS = 30_000;

/**
 * Check-in, no-show release and backfill.
 *
 * - Each device shows a daily check-in code (QR + text) on its lab kiosk; the
 *   code is an HMAC of device + date, so it can't be guessed or reused tomorrow.
 * - Students check in at the device; sessions without a check-in 15 minutes
 *   after the start are released as no-shows (counted against fair share).
 * - A released slot on instant-booking equipment is backfilled with the
 *   highest-priority pending request for it; approval-required equipment keeps
 *   faculty in the loop (safety inductions), so it is only released.
 * - There is no background worker on serverless hosting: the sweep runs
 *   lazily and idempotently on API reads, inside repository transactions.
 */
export class CheckInService {
  private lastSweepAt = 0;
  private sweeping: Promise<number> | null = null;

  constructor(
    private readonly repo: BookingRepository,
    private readonly catalog: CatalogService,
    private readonly bookings: BookingService,
    private readonly clock: Clock,
    private readonly secret: string,
    private readonly log: Pick<Console, 'warn'> = console,
  ) {}

  /** Today's check-in code for a device. */
  codeFor(equipmentId: string, date = this.clock.today()): string {
    const digest = createHmac('sha256', this.secret)
      .update(`check-in:${equipmentId}:${date}`)
      .digest();
    return Array.from(
      digest.subarray(0, CODE_LENGTH),
      (byte) => ALPHABET[byte % ALPHABET.length],
    ).join('');
  }

  /** Data for the lab kiosk display: today's code and sessions. Faculty and admins only. */
  async kiosk(persona: Persona, equipmentId: string): Promise<KioskView> {
    if (persona.role === 'student') throw forbidden('The kiosk display is for lab staff');
    const equipment = this.catalog.requireEquipment(equipmentId);
    await this.sweepIfDue();
    const today = this.clock.today();
    const sessions = (await this.repo.list({ equipmentIds: [equipment.id] }))
      .filter((b) => b.slot.date === today && (b.status === 'approved' || b.status === 'no-show'))
      .sort((a, b) => a.slot.startHour - b.slot.startHour)
      .map((b) => this.bookings.toView(b));
    return {
      equipmentId: equipment.id,
      date: today,
      code: this.codeFor(equipment.id, today),
      sessions,
    };
  }

  /** Checks the student into their current session on a device, verifying the kiosk code. */
  async checkIn(persona: Persona, equipmentId: string, code: string): Promise<BookingView> {
    if (persona.role !== 'student') throw forbidden('Only students check in to sessions');
    const equipment = this.catalog.requireEquipment(equipmentId);
    if (!this.codeMatches(code, this.codeFor(equipment.id))) {
      throw forbidden('That check-in code is not valid for this equipment today');
    }
    await this.sweepIfDue();
    const now = this.clock.campusTime();
    return this.repo.transact([equipment.id], (current) => {
      const booking = current
        .filter((b) => b.userId === persona.id && canCheckIn(b, now))
        .sort((a, b) => a.slot.startHour - b.slot.startHour)[0];
      if (!booking) {
        throw notFound(
          'A session you can check in to right now (check-in opens 15 minutes before the start)',
        );
      }
      const updated: Booking = { ...booking, checkedInAt: this.clock.now() };
      return { writes: [updated], result: this.bookings.toView(updated) };
    });
  }

  /** Runs the sweep at most once per interval per instance; never throws into the caller. */
  async sweepIfDue(): Promise<void> {
    if (this.sweeping || Date.now() - this.lastSweepAt < SWEEP_INTERVAL_MS) {
      await this.sweeping;
      return;
    }
    this.lastSweepAt = Date.now();
    this.sweeping = this.sweep().finally(() => {
      this.sweeping = null;
    });
    try {
      await this.sweeping;
    } catch (error) {
      this.log.warn(
        `[check-in] sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  /** Releases today's no-shows and backfills their slots. Returns how many were released. */
  async sweep(): Promise<number> {
    const now = this.clock.campusTime();
    const all = await this.repo.list();
    const overdue = all.filter((b) => isNoShow(b, now, this.clock.campusTime(grantedAtIso(b))));
    if (overdue.length === 0) return 0;

    const usageHours = computeUsageHours(all, now.date);
    let released = 0;
    for (const equipmentId of new Set(overdue.map((b) => b.equipmentId))) {
      const equipment = this.catalog.requireEquipment(equipmentId);
      released += await this.repo.transact([equipmentId], (current) => {
        const writes: Booking[] = [];
        const calendar = current.filter((b) => b.status === 'approved');
        // Re-check inside the transaction: another instance may have swept already.
        for (const booking of current.filter((b) =>
          isNoShow(b, now, this.clock.campusTime(grantedAtIso(b))),
        )) {
          const noShow: Booking = {
            ...booking,
            status: 'no-show',
            decision: {
              by: 'system',
              note: 'Released: no check-in within 15 minutes of the start',
              at: this.clock.now(),
            },
          };
          writes.push(noShow);
          calendar.splice(calendar.indexOf(booking), 1);
          if (equipment.requiresApproval) continue;

          const candidates = current
            .filter(
              (b) =>
                b.status === 'pending' &&
                slotsOverlap(b.slot, booking.slot) &&
                b.slot.endHour * 60 > now.minutes &&
                !writes.some((w) => w.id === b.id),
            )
            .map((b) => ({
              b,
              score: scoreRequest(b, {
                today: now.date,
                now: this.clock.now(),
                equipment,
                usageHours,
              }),
            }))
            .sort(
              (a, b) => b.score.total - a.score.total || a.b.createdAt.localeCompare(b.b.createdAt),
            );
          for (const { b } of candidates) {
            if (!hasCapacity(equipment, calendar, b.slot)) continue;
            const backfilled: Booking = {
              ...b,
              status: 'approved',
              backfilledFrom: booking.id,
              decision: {
                by: 'system',
                note: 'Auto-approved: slot released by a no-show',
                at: this.clock.now(),
              },
            };
            writes.push(backfilled);
            calendar.push(backfilled);
          }
        }
        return { writes, result: writes.filter((w) => w.status === 'no-show').length };
      });
    }
    return released;
  }

  private codeMatches(given: string, expected: string): boolean {
    const a = Buffer.from(given.trim().toUpperCase());
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
