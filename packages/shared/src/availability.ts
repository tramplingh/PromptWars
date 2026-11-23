import {
  ACTIVE_STATUSES,
  type Booking,
  type Equipment,
  type Lab,
  type TimeSlot,
} from './domain.js';
import { compareSlots, workingDays } from './time.js';

export interface HourCell {
  hour: number;
  approved: number;
  pending: number;
  /** Units still bookable in this hour (never negative). */
  free: number;
}

export interface DayAvailability {
  date: string;
  hours: HourCell[];
}

const isActive = (b: Booking) => ACTIVE_STATUSES.includes(b.status);

function coversHour(slot: TimeSlot, date: string, hour: number): boolean {
  return slot.date === date && slot.startHour <= hour && hour < slot.endHour;
}

/** Active bookings (pending or approved) occupying the given equipment-hour. */
export function occupancy(bookings: readonly Booking[], date: string, hour: number): number {
  return bookings.filter((b) => isActive(b) && coversHour(b.slot, date, hour)).length;
}

/** True when every hour of `slot` lies within lab opening hours. */
export function withinOpeningHours(lab: Lab, slot: TimeSlot): boolean {
  return (
    slot.startHour >= lab.openHour && slot.endHour <= lab.closeHour && slot.startHour < slot.endHour
  );
}

/**
 * True when `slot` can be added without exceeding the equipment's unit count
 * in any hour. Only the bookings passed in are considered, which lets callers
 * check against "approved only" or "approved + pending" calendars.
 */
export function hasCapacity(
  equipment: Equipment,
  bookings: readonly Booking[],
  slot: TimeSlot,
): boolean {
  for (let hour = slot.startHour; hour < slot.endHour; hour++) {
    if (occupancy(bookings, slot.date, hour) >= equipment.units) return false;
  }
  return true;
}

export function computeAvailability(
  equipment: Equipment,
  lab: Lab,
  bookings: readonly Booking[],
  from: string,
  days: number,
): DayAvailability[] {
  const active = bookings.filter((b) => b.equipmentId === equipment.id && isActive(b));
  return workingDays(from, days).map((date) => ({
    date,
    hours: range(lab.openHour, lab.closeHour).map((hour) => {
      const covering = active.filter((b) => coversHour(b.slot, date, hour));
      const approved = covering.filter((b) => b.status === 'approved').length;
      const pending = covering.length - approved;
      return { hour, approved, pending, free: Math.max(0, equipment.units - covering.length) };
    }),
  }));
}

export interface FreeSlotQuery {
  equipment: Equipment;
  lab: Lab;
  bookings: readonly Booking[];
  from: string;
  days: number;
  durationHours: number;
  /** Slots must end on or before this date (inclusive). */
  latestDate?: string;
  /** Preferred slot; results are ranked by closeness to it. */
  near?: TimeSlot;
  limit?: number;
}

/**
 * Finds bookable slots of the requested duration, ranked by proximity to the
 * preferred slot (if any) and then chronologically.
 */
export function findFreeSlots(query: FreeSlotQuery): TimeSlot[] {
  const {
    equipment,
    lab,
    bookings,
    from,
    days,
    durationHours,
    latestDate,
    near,
    limit = 3,
  } = query;
  if (equipment.status !== 'operational') return [];

  const candidates: TimeSlot[] = [];
  for (const date of workingDays(from, days)) {
    if (latestDate && date > latestDate) break;
    for (let start = lab.openHour; start + durationHours <= lab.closeHour; start++) {
      const slot = { date, startHour: start, endHour: start + durationHours };
      if (hasCapacity(equipment, bookings, slot)) candidates.push(slot);
    }
  }

  const distance = (slot: TimeSlot) =>
    near
      ? Math.abs(dayIndex(slot.date) - dayIndex(near.date)) * 24 +
        Math.abs(slot.startHour - near.startHour)
      : 0;

  return candidates.sort((a, b) => distance(a) - distance(b) || compareSlots(a, b)).slice(0, limit);
}

function dayIndex(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
}
