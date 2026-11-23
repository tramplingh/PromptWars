import {
  ACTIVE_STATUSES,
  addDays,
  slotHours,
  workingDays,
  type UtilisationReport,
} from '@lablink/shared';
import type { Clock } from '../lib/clock.js';
import type { BookingRepository } from '../repositories/bookingRepository.js';
import type { CatalogService } from './catalogService.js';

export const REPORT_WORKING_DAYS = 10;

/** Utilisation analytics over a rolling window centred on today. */
export class InsightsService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly catalog: CatalogService,
    private readonly clock: Clock,
  ) {}

  async utilisation(): Promise<UtilisationReport> {
    const today = this.clock.today();
    // Window: the previous week plus the next working week.
    const from = addDays(today, -7);
    const days = workingDays(from, REPORT_WORKING_DAYS);
    const to = days[days.length - 1] ?? today;
    const inWindow = new Set(days);

    const bookings = (await this.repo.list({ statuses: ACTIVE_STATUSES })).filter((b) =>
      inWindow.has(b.slot.date),
    );
    const hourLoad = new Map<number, number>();

    const items = this.catalog.equipment.map((e) => {
      const lab = this.catalog.labFor(e);
      const own = bookings.filter((b) => b.equipmentId === e.id);
      const approvedHours = sumHours(own.filter((b) => b.status === 'approved'));
      const pendingHours = sumHours(own.filter((b) => b.status === 'pending'));
      const capacityHours =
        e.status === 'operational' ? e.units * (lab.closeHour - lab.openHour) * days.length : 0;
      for (const b of own) {
        for (let h = b.slot.startHour; h < b.slot.endHour; h++)
          hourLoad.set(h, (hourLoad.get(h) ?? 0) + 1);
      }
      return {
        equipmentId: e.id,
        name: e.name,
        departmentId: e.departmentId,
        approvedHours,
        pendingHours,
        capacityHours,
        utilisation: capacityHours ? round(approvedHours / capacityHours) : 0,
      };
    });

    const totalCapacity = items.reduce((s, i) => s + i.capacityHours, 0);
    const totalApproved = items.reduce((s, i) => s + i.approvedHours, 0);
    const peakHours = [...hourLoad.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hour, load]) => ({ hour, load }));

    return {
      from: days[0] ?? from,
      to,
      items: items.sort((a, b) => b.utilisation - a.utilisation || b.pendingHours - a.pendingHours),
      peakHours,
      overall: totalCapacity ? round(totalApproved / totalCapacity) : 0,
    };
  }
}

const sumHours = (list: { slot: Parameters<typeof slotHours>[0] }[]) =>
  list.reduce((s, b) => s + slotHours(b.slot), 0);
const round = (n: number) => Math.round(n * 1000) / 1000;
