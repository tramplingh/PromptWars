import type { Booking } from '@lablink/shared';
import type { Firestore, Query } from 'firebase-admin/firestore';
import {
  matchesFilter,
  type BookingFilter,
  type BookingRepository,
  type TransactionResult,
} from './bookingRepository.js';

const COLLECTION = 'bookings';
/** Firestore limits `in` queries to 30 values. */
const IN_QUERY_LIMIT = 30;

/**
 * Firestore-backed repository. Capacity checks run inside Firestore
 * transactions, so concurrent requests on serverless instances stay consistent.
 * Only the server (Admin SDK) touches Firestore; clients never get direct access.
 */
export class FirestoreBookingRepository implements BookingRepository {
  constructor(private readonly db: Firestore) {}

  private get collection() {
    return this.db.collection(COLLECTION);
  }

  async list(filter: BookingFilter = {}): Promise<Booking[]> {
    let query: Query = this.collection;
    if (filter.userId) query = query.where('userId', '==', filter.userId);
    if (filter.equipmentIds) {
      if (filter.equipmentIds.length === 0) return [];
      if (filter.equipmentIds.length <= IN_QUERY_LIMIT)
        query = query.where('equipmentId', 'in', [...filter.equipmentIds]);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((d) => d.data() as Booking).filter((b) => matchesFilter(b, filter));
  }

  async get(id: string): Promise<Booking | undefined> {
    const doc = await this.collection.doc(id).get();
    return doc.exists ? (doc.data() as Booking) : undefined;
  }

  async transact<T>(
    equipmentIds: readonly string[],
    fn: (current: Booking[]) => TransactionResult<T>,
  ): Promise<T> {
    if (equipmentIds.length === 0 || equipmentIds.length > IN_QUERY_LIMIT) {
      throw new Error(`transact supports 1–${IN_QUERY_LIMIT} equipment ids`);
    }
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(this.collection.where('equipmentId', 'in', [...equipmentIds]));
      const { writes, result } = fn(snapshot.docs.map((d) => d.data() as Booking));
      for (const booking of writes)
        tx.set(this.collection.doc(booking.id), stripUndefined(booking));
      return result;
    });
  }

  /** Inserts the demo seed only when the collection is empty (first deploy). */
  async seedIfEmpty(seed: readonly Booking[]): Promise<void> {
    const existing = await this.collection.limit(1).get();
    if (!existing.empty) return;
    const batch = this.db.batch();
    for (const booking of seed) batch.set(this.collection.doc(booking.id), stripUndefined(booking));
    await batch.commit();
  }
}

/** Firestore rejects `undefined` field values. */
function stripUndefined<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
