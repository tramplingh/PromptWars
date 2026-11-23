import {
  ACTIVE_STATUSES,
  addDays,
  capabilityFit,
  computeAvailability,
  findFreeSlots,
  formatSlot,
  hasCapacity,
  isWeekend,
  slotHours,
  slotsOverlap,
  withinOpeningHours,
  type Alternative,
  type Booking,
  type BookingOutcome,
  type BookingView,
  type CreateBookingInput,
  type Equipment,
  type EquipmentDetail,
  type Persona,
} from '@lablink/shared';
import type { Clock } from '../lib/clock.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { newBookingId } from '../lib/ids.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { CatalogService } from './catalogService.js';

/** Students may book up to this many calendar days ahead. */
export const BOOKING_HORIZON_DAYS = 30;
/** Working days of availability returned by default. */
export const DEFAULT_AVAILABILITY_DAYS = 5;

export class BookingService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly catalog: CatalogService,
    private readonly clock: Clock,
  ) {}

  async equipmentDetail(
    equipmentId: string,
    from?: string,
    days = DEFAULT_AVAILABILITY_DAYS,
  ): Promise<EquipmentDetail> {
    const equipment = this.catalog.requireEquipment(equipmentId);
    const lab = this.catalog.labFor(equipment);
    const bookings = await this.repo.list({
      equipmentIds: [equipment.id],
      statuses: ACTIVE_STATUSES,
    });
    return {
      equipment,
      lab,
      department: this.catalog.department(equipment.departmentId),
      availability: computeAvailability(equipment, lab, bookings, from ?? this.clock.today(), days),
    };
  }

  async listForUser(userId: string): Promise<BookingView[]> {
    const bookings = await this.repo.list({ userId });
    return bookings
      .sort((a, b) => b.slot.date.localeCompare(a.slot.date) || b.slot.startHour - a.slot.startHour)
      .map((b) => this.toView(b));
  }

  /**
   * Creates a booking request and decides its initial state:
   * - slot already taken by approved bookings → 409 with fair alternatives
   * - equipment needs approval → pending (awaiting faculty)
   * - slot contended by other pending requests → pending (queued for conflict resolution)
   * - otherwise → instantly confirmed
   */
  async create(
    persona: Persona,
    input: CreateBookingInput,
  ): Promise<{ booking: BookingView; outcome: BookingOutcome }> {
    if (persona.role !== 'student') throw forbidden('Only students can request equipment');

    const equipment = this.catalog.requireEquipment(input.equipmentId);
    this.assertBookable(equipment, input);

    const ownActive = await this.repo.list({ userId: persona.id, statuses: ACTIVE_STATUSES });
    const clash = ownActive.find((b) => slotsOverlap(b.slot, input.slot));
    if (clash) {
      const name = this.catalog.findEquipment(clash.equipmentId)?.name ?? 'another item';
      throw conflict(`You already have a booking at this time: ${name}, ${formatSlot(clash.slot)}`);
    }

    const created = await this.repo.transact([equipment.id], (current) => {
      const active = current.filter((b) => ACTIVE_STATUSES.includes(b.status));
      const approved = active.filter((b) => b.status === 'approved');

      if (!hasCapacity(equipment, approved, input.slot)) return { writes: [], result: null };

      const contended = !hasCapacity(equipment, active, input.slot);
      const outcome: BookingOutcome = contended
        ? 'queued-for-resolution'
        : equipment.requiresApproval
          ? 'awaiting-approval'
          : 'confirmed';

      const now = this.clock.now();
      const booking: Booking = {
        id: newBookingId(),
        equipmentId: equipment.id,
        userId: persona.id,
        slot: input.slot,
        project: input.project,
        status: outcome === 'confirmed' ? 'approved' : 'pending',
        createdAt: now,
        ...(outcome === 'confirmed' && {
          decision: { by: 'system', note: 'Auto-confirmed: slot was free', at: now },
        }),
      };
      return { writes: [booking], result: { booking: this.toView(booking), outcome } };
    });

    if (created) return created;
    // Slot taken: only now pay for a campus-wide calendar read to suggest alternatives.
    const calendar = await this.repo.list({ statuses: ACTIVE_STATUSES });
    throw conflict('That slot is already booked', {
      alternatives: this.suggestAlternatives(equipment, input, calendar),
    });
  }

  async cancel(persona: Persona, bookingId: string): Promise<BookingView> {
    const existing = await this.repo.get(bookingId);
    if (!existing) throw notFound('Booking');
    if (existing.userId !== persona.id) throw forbidden('You can only cancel your own bookings');

    return this.repo.transact([existing.equipmentId], (current) => {
      const booking = current.find((b) => b.id === bookingId);
      if (!booking || !ACTIVE_STATUSES.includes(booking.status))
        throw conflict('This booking can no longer be cancelled');
      if (booking.slot.date < this.clock.today())
        throw conflict('Past bookings cannot be cancelled');
      const updated: Booking = { ...booking, status: 'cancelled' };
      return { writes: [updated], result: this.toView(updated) };
    });
  }

  toView(booking: Booking): BookingView {
    return {
      ...booking,
      equipmentName: this.catalog.findEquipment(booking.equipmentId)?.name ?? 'Unknown equipment',
      userName: this.catalog.personaName(booking.userId),
    };
  }

  private assertBookable(equipment: Equipment, input: CreateBookingInput): void {
    const today = this.clock.today();
    const { slot, project } = input;
    if (equipment.status !== 'operational')
      throw conflict(`${equipment.name} is under maintenance`);
    if (slot.date < today) throw badRequest('Choose a date from today onwards');
    if (slot.date > addDays(today, BOOKING_HORIZON_DAYS)) {
      throw badRequest(`Bookings open ${BOOKING_HORIZON_DAYS} days in advance`);
    }
    if (isWeekend(slot.date)) throw badRequest('Labs are closed on weekends');
    if (!withinOpeningHours(this.catalog.labFor(equipment), slot))
      throw badRequest('Slot is outside lab opening hours');
    if (slotHours(slot) > equipment.maxHoursPerBooking) {
      throw badRequest(
        `${equipment.name} can be booked for at most ${equipment.maxHoursPerBooking}h at a time`,
      );
    }
    if (project.deadline < slot.date)
      throw badRequest('The slot must be on or before your project deadline');
  }

  private suggestAlternatives(
    equipment: Equipment,
    input: CreateBookingInput,
    calendar: readonly Booking[],
  ): Alternative[] {
    const today = this.clock.today();
    const durationHours = slotHours(input.slot);
    const sameDevice = findFreeSlots({
      equipment,
      lab: this.catalog.labFor(equipment),
      bookings: calendar.filter((b) => b.equipmentId === equipment.id),
      from: today,
      days: 10,
      durationHours,
      latestDate: input.project.deadline,
      near: input.slot,
      limit: 2,
    }).map((slot): Alternative => ({
      kind: 'same-equipment-other-time',
      equipmentId: equipment.id,
      slot,
    }));

    const baseFit = capabilityFit(input.project.requirements, equipment);
    const equivalents = this.catalog.equipment
      .filter(
        (e) =>
          e.id !== equipment.id && e.status === 'operational' && e.category === equipment.category,
      )
      .filter((e) => capabilityFit(input.project.requirements, e) >= baseFit)
      .filter((e) => withinOpeningHours(this.catalog.labFor(e), input.slot))
      .filter((e) =>
        hasCapacity(
          e,
          calendar.filter((b) => b.equipmentId === e.id),
          input.slot,
        ),
      )
      .slice(0, 2)
      .map((e): Alternative => ({
        kind: 'equivalent-same-time',
        equipmentId: e.id,
        slot: input.slot,
      }));

    return [...equivalents, ...sameDevice];
  }
}
