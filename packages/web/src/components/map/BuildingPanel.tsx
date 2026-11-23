import type { Equipment, LiveStatus } from '@lablink/shared';
import { ArrowRight, Footprints, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Building } from '../../lib/campusLayout';
import { summariseLive } from '../../lib/catalogFilters';
import { useCatalogIndex } from '../../lib/queries';
import { ApprovalBadge } from '../Badges';
import { CategoryIcon } from '../CategoryIcon';
import { LIVE_STYLE, LiveStatusPill, liveStatusText } from '../ui/LiveStatusPill';

interface Props {
  building: Building;
  home: Building | undefined;
  selected: Equipment | undefined;
  equipment: Equipment[];
  live: ReadonlyMap<string, LiveStatus>;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Frosted detail panel: the selected building's equipment, plus the selected item and its route. */
export function BuildingPanel({
  building,
  home,
  selected,
  equipment,
  live,
  onSelect,
  onClose,
}: Props) {
  const isHome = home?.departmentId === building.departmentId;
  return (
    <aside
      aria-label={selected ? `${selected.name} details` : `${building.name} details`}
      aria-live="polite"
      className="glass relative z-30 m-3 flex max-h-[30rem] animate-fade-in flex-col overflow-hidden 2xl:absolute 2xl:bottom-3 2xl:right-3 2xl:m-0 2xl:max-h-[70%] 2xl:w-72"
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">{building.name}</p>
          <p className="text-xs text-slate-500">
            {equipment.length} shared item{equipment.length === 1 ? '' : 's'}
            {isHome && ' · your department'}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn -mr-2 h-8 w-8"
          aria-label="Close details"
          onClick={onClose}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {selected && (
          <SelectedEquipment
            item={selected}
            building={building}
            home={home}
            status={live.get(selected.id)}
          />
        )}
        <StatusBar equipment={equipment} live={live} />
        <BuildingEquipment
          equipment={equipment}
          live={live}
          selectedId={selected?.id}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}

function SelectedEquipment({
  item,
  building,
  home,
  status,
}: {
  item: Equipment;
  building: Building;
  home: Building | undefined;
  status: LiveStatus | undefined;
}) {
  const index = useCatalogIndex();
  const routeText =
    !home || home.departmentId === building.departmentId
      ? 'In your own department building.'
      : `Route shown: ${home.name} → ${building.name}, via the central avenue.`;
  const operational = item.status === 'operational';
  return (
    <div className="border-b border-slate-200/70 bg-white/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <CategoryIcon category={item.category} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{item.name}</p>
          <p className="text-xs text-slate-500">{index.labs.get(item.labId)?.location}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <LiveStatusPill status={status} />
        {operational && <ApprovalBadge requiresApproval={item.requiresApproval} />}
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-600">
        <Footprints aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-brand-700" />
        {routeText}
      </p>
      <Link to={`/equipment/${item.id}`} className="btn-primary mt-3 w-full">
        {operational ? 'View availability & book' : 'View details'}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** Stacked available / busy / closed / down bar for the building's equipment. */
function StatusBar({
  equipment,
  live,
}: {
  equipment: Equipment[];
  live: ReadonlyMap<string, LiveStatus>;
}) {
  const statuses = equipment.flatMap((e) => live.get(e.id) ?? []);
  const summary = summariseLive(statuses);
  const segments = [
    { label: 'available', count: summary.available, color: LIVE_STYLE.available.fill },
    { label: 'busy', count: summary.busy, color: LIVE_STYLE['in-use'].fill },
    {
      label: 'closed',
      count: statuses.filter((s) => s.state === 'closed').length,
      color: LIVE_STYLE.closed.fill,
    },
    { label: 'down', count: summary.down, color: LIVE_STYLE.maintenance.fill },
  ];
  const total = Math.max(1, equipment.length);
  return (
    <div className="px-4 py-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        {segments.map((s) => (
          <span
            key={s.label}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-2xs text-slate-600">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => `${s.count} ${s.label}`)
          .join(' · ')}
      </p>
    </div>
  );
}

function BuildingEquipment({
  equipment,
  live,
  selectedId,
  onSelect,
}: {
  equipment: Equipment[];
  live: ReadonlyMap<string, LiveStatus>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const index = useCatalogIndex();
  return (
    <ul className="divide-y divide-slate-200/60 border-t border-slate-200/70">
      {equipment.map((e) => {
        const status = live.get(e.id);
        const active = e.id === selectedId;
        return (
          <li key={e.id}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(e.id)}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${active ? 'bg-brand-50/90' : 'hover:bg-white/70'}`}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: status ? LIVE_STYLE[status.state].fill : '#94a3b8' }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">{e.name}</span>
                <span className="block truncate text-2xs text-slate-500">
                  {index.labs.get(e.labId)?.name} · {status ? liveStatusText(status) : '…'}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
