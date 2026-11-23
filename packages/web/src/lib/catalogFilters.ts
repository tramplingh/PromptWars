import type { Equipment, LiveState, LiveStatus } from '@lablink/shared';

export type Availability = '' | 'now' | 'instant';

export interface CatalogFilter {
  department: string;
  category: string;
  availability: Availability;
  /** Lower-cased keyword matched against name, description and capabilities. */
  keyword: string;
}

export const EMPTY_FILTER: CatalogFilter = {
  department: '',
  category: '',
  availability: '',
  keyword: '',
};

/** Pure catalogue filter shared by the grid and table views. */
export function filterCatalog(
  equipment: readonly Equipment[],
  filter: CatalogFilter,
  live: ReadonlyMap<string, LiveStatus>,
): Equipment[] {
  const keyword = filter.keyword.trim().toLowerCase();
  return equipment.filter((e) => {
    if (filter.department && e.departmentId !== filter.department) return false;
    if (filter.category && e.category !== filter.category) return false;
    if (filter.availability === 'now' && live.get(e.id)?.state !== 'available') return false;
    if (filter.availability === 'instant' && (e.requiresApproval || e.status !== 'operational'))
      return false;
    return (
      !keyword ||
      `${e.name} ${e.description} ${e.capabilities.join(' ')}`.toLowerCase().includes(keyword)
    );
  });
}

export interface LiveSummary {
  available: number;
  /** In use or fully requested. */
  busy: number;
  down: number;
}

const isBusy = (s: LiveState) => s === 'in-use' || s === 'requested';

/** Counts of live states for summary strips (catalogue and map). */
export function summariseLive(statuses: Iterable<LiveStatus>): LiveSummary {
  const states = [...statuses].map((s) => s.state);
  return {
    available: states.filter((s) => s === 'available').length,
    busy: states.filter(isBusy).length,
    down: states.filter((s) => s === 'maintenance').length,
  };
}
