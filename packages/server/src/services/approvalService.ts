import {
  ACTIVE_STATUSES,
  computeUsageHours,
  detectConflicts,
  hasCapacity,
  resolveConflict,
  scoreRequest,
  type AllocationPlan,
  type ApprovalQueue,
  type Booking,
  type BookingView,
  type DecisionInput,
  type Equipment,
  type Persona,
  type ScoredBooking,
} from '@lablink/shared';
import type { Clock } from '../lib/clock.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { BookingService } from './bookingService.js';
import type { CatalogService } from './catalogService.js';

/**
 * Faculty-facing workflows: the approval queue, single decisions and applying
 * the engine's fair allocation plan to a whole conflict at once.
 */
export class ApprovalService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly catalog: CatalogService,
    private readonly bookings: BookingService,
    private readonly clock: Clock,
  ) {}

  async queue(persona: Persona): Promise<ApprovalQueue> {
    const managed = this.managedEquipment(persona);
    const all = await this.repo.list({ statuses: ACTIVE_STATUSES });
    const plans = this.plansFor(managed, all);

    const conflictByBooking = new Map<string, string>();
    for (const plan of plans)
      for (const id of plan.conflict.pendingIds) conflictByBooking.set(id, plan.conflict.id);

    const today = this.clock.today();
    const now = this.clock.now();
    const usageHours = computeUsageHours(all, today);
    const managedIds = new Set(managed.map((e) => e.id));

    const pending: ScoredBooking[] = all
      .filter((b) => b.status === 'pending' && managedIds.has(b.equipmentId))
      .map((b) => {
        const equipment = this.catalog.requireEquipment(b.equipmentId);
        const conflictId = conflictByBooking.get(b.id);
        return {
          ...this.bookings.toView(b),
          score: scoreRequest(b, { today, now, equipment, usageHours }),
          ...(conflictId && { conflictId }),
        };
      })
      .sort((a, b) => b.score.total - a.score.total || a.createdAt.localeCompare(b.createdAt));

    return { pending, conflicts: plans };
  }

  async decide(persona: Persona, bookingId: string, input: DecisionInput): Promise<BookingView> {
    const existing = await this.repo.get(bookingId);
    if (!existing) throw notFound('Booking');
    const equipment = this.catalog.requireEquipment(existing.equipmentId);
    this.assertManages(persona, equipment);

    return this.repo.transact([equipment.id], (current) => {
      const booking = current.find((b) => b.id === bookingId);
      if (!booking || booking.status !== 'pending')
        throw conflict('This request has already been decided');

      if (input.decision === 'approve') {
        const approved = current.filter((b) => b.status === 'approved');
        if (!hasCapacity(equipment, approved, booking.slot)) {
          throw conflict(
            'Approving would exceed capacity. Use the recommended allocation for this conflict.',
          );
        }
      }
      const updated: Booking = {
        ...booking,
        status: input.decision === 'approve' ? 'approved' : 'rejected',
        decision: { by: persona.id, note: input.note, at: this.clock.now() },
      };
      return { writes: [updated], result: this.bookings.toView(updated) };
    });
  }

  async plan(persona: Persona, conflictId: string): Promise<AllocationPlan> {
    const equipmentId = conflictId.split('_')[0] ?? '';
    const equipment = this.catalog.findEquipment(equipmentId);
    if (!equipment) throw notFound('Conflict');
    this.assertManages(persona, equipment);

    const all = await this.repo.list({ statuses: ACTIVE_STATUSES });
    const plan = this.plansFor([equipment], all).find((p) => p.conflict.id === conflictId);
    if (!plan) throw notFound('Conflict (it may already be resolved)');
    return plan;
  }

  /**
   * Applies the engine's recommendation. The plan is always recomputed on the
   * server (never trusted from the client) and re-validated inside a
   * transaction, so a stale view cannot overwrite newer decisions.
   */
  async applyPlan(persona: Persona, conflictId: string): Promise<BookingView[]> {
    const plan = await this.plan(persona, conflictId);
    const involved = new Set<string>([plan.conflict.equipmentId]);
    for (const d of plan.decisions)
      if (d.alternatives[0]) involved.add(d.alternatives[0].equipmentId);

    const now = this.clock.now();
    return this.repo.transact([...involved], (current) => {
      const byId = new Map(current.map((b) => [b.id, b]));
      const calendar = current.filter((b) => b.status === 'approved');
      const writes: Booking[] = [];

      for (const decision of plan.decisions) {
        const booking = byId.get(decision.bookingId);
        if (!booking || booking.status !== 'pending') {
          throw conflict(
            'The calendar changed while you were reviewing. Refresh to see the updated plan.',
          );
        }
        const move = decision.outcome === 'reassign' ? decision.alternatives[0] : undefined;
        const target = move
          ? { equipmentId: move.equipmentId, slot: move.slot }
          : { equipmentId: booking.equipmentId, slot: booking.slot };
        const targetEquipment = this.catalog.requireEquipment(target.equipmentId);
        const placeable =
          (decision.outcome === 'allocate' || move) &&
          hasCapacity(
            targetEquipment,
            calendar.filter((b) => b.equipmentId === target.equipmentId),
            target.slot,
          );

        if (!placeable) {
          writes.push({
            ...booking,
            status: 'rejected',
            decision: {
              by: persona.id,
              note: 'No feasible slot before your deadline. Please submit a new request.',
              at: now,
            },
          });
          continue;
        }

        const updated: Booking = {
          ...booking,
          ...target,
          status: 'approved',
          decision: {
            by: persona.id,
            note: move
              ? 'Reallocated by fair-share conflict resolution'
              : 'Allocated by fair-share conflict resolution',
            at: now,
          },
          ...(move && {
            reallocatedFrom: { equipmentId: booking.equipmentId, slot: booking.slot },
          }),
        };
        calendar.push(updated);
        writes.push(updated);
      }
      return { writes, result: writes.map((b) => this.bookings.toView(b)) };
    });
  }

  private plansFor(equipment: readonly Equipment[], all: readonly Booking[]): AllocationPlan[] {
    const today = this.clock.today();
    const now = this.clock.now();
    return equipment.flatMap((e) =>
      detectConflicts(e, all).map((group) =>
        resolveConflict({
          conflict: group,
          bookings: all,
          equipment: this.catalog.equipment,
          labs: this.catalog.labs,
          today,
          now,
        }),
      ),
    );
  }

  private managedEquipment(persona: Persona): Equipment[] {
    if (persona.role === 'admin') return [...this.catalog.equipment];
    if (persona.role === 'faculty')
      return this.catalog.equipment.filter((e) => e.departmentId === persona.departmentId);
    throw forbidden('Only faculty and lab administrators can review requests');
  }

  private assertManages(persona: Persona, equipment: Equipment): void {
    const allowed =
      persona.role === 'admin' ||
      (persona.role === 'faculty' && persona.departmentId === equipment.departmentId);
    if (!allowed)
      throw forbidden('Only the faculty in-charge of this lab can decide on its requests');
  }
}
