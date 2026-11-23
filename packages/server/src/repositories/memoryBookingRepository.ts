import type { Booking } from '@lablink/shared';
import {
  matchesFilter,
  type BookingFilter,
  type BookingRepository,
  type TransactionResult,
} from './bookingRepository.js';

const clone = <T>(value: T): T => structuredClone(value);

/**
 * In-process repository used for local development and tests. Transactions are
 * serialised through a promise chain, which gives the same isolation guarantee
 * as a database transaction for a single Node.js process.
 */
export class MemoryBookingRepository implements BookingRepository {
  private readonly bookings = new Map<string, Booking>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(seed: readonly Booking[] = []) {
    for (const booking of seed) this.bookings.set(booking.id, clone(booking));
  }

  async list(filter?: BookingFilter): Promise<Booking[]> {
    return [...this.bookings.values()].filter((b) => matchesFilter(b, filter)).map(clone);
  }

  async get(id: string): Promise<Booking | undefined> {
    const booking = this.bookings.get(id);
    return booking && clone(booking);
  }

  transact<T>(
    equipmentIds: readonly string[],
    fn: (current: Booking[]) => TransactionResult<T>,
  ): Promise<T> {
    const run = async () => {
      const current = await this.list({ equipmentIds });
      const { writes, result } = fn(current);
      for (const booking of writes) this.bookings.set(booking.id, clone(booking));
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
