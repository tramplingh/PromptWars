import type { Booking, BookingStatus } from '@lablink/shared';

export interface BookingFilter {
  userId?: string;
  equipmentIds?: readonly string[];
  statuses?: readonly BookingStatus[];
}

export interface TransactionResult<T> {
  /** Bookings to create or overwrite (matched by id). */
  writes: Booking[];
  result: T;
}

/**
 * Persistence boundary for bookings. All read-modify-write flows go through
 * {@link BookingRepository.transact} so capacity checks and the writes they
 * justify happen atomically — two students can never win the same slot.
 */
export interface BookingRepository {
  list(filter?: BookingFilter): Promise<Booking[]>;
  get(id: string): Promise<Booking | undefined>;
  /**
   * Runs `fn` against a consistent snapshot of the bookings for the given
   * equipment and commits its writes atomically. `fn` may throw to abort.
   */
  transact<T>(
    equipmentIds: readonly string[],
    fn: (current: Booking[]) => TransactionResult<T>,
  ): Promise<T>;
}

export function matchesFilter(booking: Booking, filter: BookingFilter = {}): boolean {
  if (filter.userId && booking.userId !== filter.userId) return false;
  if (filter.equipmentIds && !filter.equipmentIds.includes(booking.equipmentId)) return false;
  if (filter.statuses && !filter.statuses.includes(booking.status)) return false;
  return true;
}
