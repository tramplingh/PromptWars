import { LayoutGrid, Rows3 } from 'lucide-react';
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AiSearchPanel } from '../components/AiSearchPanel';
import { CatalogFilters } from '../components/equipment/CatalogFilters';
import { CatalogGrid, CatalogTable } from '../components/equipment/CatalogViews';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/States';
import { Segmented } from '../components/ui/Segmented';
import {
  EMPTY_FILTER,
  filterCatalog,
  summariseLive,
  type CatalogFilter,
} from '../lib/catalogFilters';
import { useCatalog, useLiveStatus } from '../lib/queries';

type View = 'grid' | 'table';

const LAYOUTS = [
  {
    value: 'grid' as const,
    label: 'Grid',
    icon: <LayoutGrid aria-hidden="true" className="h-4 w-4" />,
  },
  {
    value: 'table' as const,
    label: 'Table',
    icon: <Rows3 aria-hidden="true" className="h-4 w-4" />,
  },
];

/** Campus catalogue: AI matcher on top, filterable grid/table of every shared instrument below. */
export function EquipmentListPage() {
  const catalog = useCatalog();
  const { byId: live } = useLiveStatus();
  const [params] = useSearchParams();
  const [view, setView] = useState<View>('grid');
  const [filter, setFilter] = useState<CatalogFilter>(EMPTY_FILTER);
  const keyword = useDeferredValue(filter.keyword);

  const equipment = useMemo(() => catalog.data?.equipment ?? [], [catalog.data]);
  const filtered = useMemo(
    () => filterCatalog(equipment, { ...filter, keyword }, live),
    [equipment, filter, keyword, live],
  );
  const summary = useMemo(() => summariseLive(live.values()), [live]);
  const stats: [string, number][] = [
    ['Total assets', equipment.length],
    ['Available now', summary.available],
    ['In use / requested', summary.busy],
    ['Down', summary.down],
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="mt-1 text-sm text-slate-600">
            Specialised instruments, kits and workstations shared across every department.
          </p>
        </div>
        <dl className="flex divide-x divide-slate-200 rounded-card border border-slate-200 bg-white text-sm">
          {stats.map(([label, value]) => (
            <div key={label} className="px-4 py-2">
              <dt className="text-2xs text-slate-500">{label}</dt>
              <dd className="metric text-lg">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <AiSearchPanel initialQuery={params.get('ask') ?? undefined} compact />

      <section aria-labelledby="catalog-title" className="card">
        <div className="card-header">
          <div>
            <h2 id="catalog-title" className="card-title">
              Campus catalogue
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filtered.length} of {equipment.length}
            </p>
          </div>
          <Segmented<View> label="Layout" value={view} onChange={setView} options={LAYOUTS} />
        </div>
        <CatalogFilters
          filter={filter}
          departments={catalog.data?.departments ?? []}
          onChange={setFilter}
        />
        <div className="p-5">
          <CatalogBody state={catalog} isEmpty={filtered.length === 0}>
            {view === 'grid' ? (
              <CatalogGrid items={filtered} live={live} />
            ) : (
              <CatalogTable items={filtered} live={live} />
            )}
          </CatalogBody>
        </div>
      </section>
    </div>
  );
}

/** Loading / error / empty states around the catalogue results. */
function CatalogBody({
  state,
  isEmpty,
  children,
}: {
  state: ReturnType<typeof useCatalog>;
  isEmpty: boolean;
  children: ReactNode;
}) {
  if (state.isPending) return <SkeletonGrid />;
  if (state.isError) return <ErrorState error={state.error} onRetry={() => void state.refetch()} />;
  if (isEmpty) {
    return (
      <EmptyState title="Nothing matches these filters">
        Clear a filter or describe your need in the AI search above.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
