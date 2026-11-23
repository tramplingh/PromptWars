import {
  addDays,
  type ActivityEvent,
  type ActivityType,
  type Booking,
  type Persona,
} from '@lablink/shared';
import type { Clock } from '../lib/clock.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { CatalogService } from './catalogService.js';

/** How far back the updates feed looks. */
export const ACTIVITY_WINDOW_DAYS = 7;
export const ACTIVITY_LIMIT = 30;

/**
 * Derives a role-scoped updates feed from booking history: new requests,
 * instant confirmations, faculty decisions and fair-share reallocations.
 * Deriving (rather than storing) events keeps a single source of truth.
 */
export class ActivityService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly catalog: CatalogService,
    private readonly clock: Clock,
  ) {}

  async feed(persona: Persona): Promise<ActivityEvent[]> {
    const bookings =
      persona.role === 'student'
        ? await this.repo.list({ userId: persona.id })
        : await this.repo.list();
    const inDepartment = (equipmentId: string) =>
      this.catalog.findEquipment(equipmentId)?.departmentId === persona.departmentId;
    // Faculty also see bookings their conflict resolution moved to another department's device.
    const visible =
      persona.role === 'faculty'
        ? bookings.filter(
            (b) =>
              inDepartment(b.equipmentId) ||
              (b.reallocatedFrom !== undefined && inDepartment(b.reallocatedFrom.equipmentId)),
          )
        : bookings;
    const since = `${addDays(this.clock.today(), -ACTIVITY_WINDOW_DAYS)}T00:00:00.000Z`;

    return visible
      .flatMap((b) => this.eventsFor(b))
      .filter((e) => e.at >= since)
      .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
      .slice(0, ACTIVITY_LIMIT);
  }

  private eventsFor(booking: Booking): ActivityEvent[] {
    const { decision } = booking;
    const autoConfirmed = isInstantConfirmation(booking);
    const events = [
      this.event(booking, autoConfirmed ? 'confirmed' : 'requested', booking.createdAt),
    ];
    if (decision && !autoConfirmed) {
      events.push(
        this.event(booking, decisionEventType(booking), decision.at, decision.note || undefined),
      );
    }
    if (booking.checkedInAt) events.push(this.event(booking, 'checked-in', booking.checkedInAt));
    return events;
  }

  private event(booking: Booking, type: ActivityType, at: string, note?: string): ActivityEvent {
    return {
      id: `${booking.id}:${type}`,
      type,
      at,
      bookingId: booking.id,
      equipmentId: booking.equipmentId,
      equipmentName: this.catalog.findEquipment(booking.equipmentId)?.name ?? 'Equipment',
      studentName: this.catalog.personaName(booking.userId),
      slot: booking.slot,
      projectTitle: booking.project.title,
      deadline: booking.project.deadline,
      ...(note && { note }),
    };
  }
}

/**
 * System decisions on a fresh booking mean it was confirmed instantly; later
 * system decisions are the no-show sweep (release) and its backfill.
 */
function isInstantConfirmation(booking: Booking): boolean {
  const releasedOrBackfilled = booking.status === 'no-show' || booking.backfilledFrom !== undefined;
  return booking.decision?.by === 'system' && !releasedOrBackfilled;
}

/** Which kind of event a booking's decision represents, most specific first. */
export function decisionEventType(booking: Booking): ActivityType {
  if (booking.status === 'no-show') return 'no-show';
  if (booking.backfilledFrom) return 'backfilled';
  if (booking.reallocatedFrom) return 'reallocated';
  return booking.status === 'rejected' ? 'declined' : 'approved';
}
