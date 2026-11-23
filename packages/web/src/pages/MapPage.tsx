import type { Equipment, LiveState, LiveStatus } from '@lablink/shared';
import { ArrowRight, Footprints, Minus, Plus, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApprovalBadge } from '../components/Badges';
import { CategoryIcon } from '../components/CategoryIcon';
import { IsoCampus, type PinStem } from '../components/map/IsoCampus';
import { ErrorState, Loading } from '../components/States';
import { LIVE_STYLE, LiveStatusPill, liveStatusText } from '../components/ui/LiveStatusPill';
import { Segmented } from '../components/ui/Segmented';
import {
  BUILDINGS,
  VIEWBOX,
  labelPoint,
  roofPins,
  routeBetween,
  toPercent,
  type Building,
} from '../lib/campusLayout';
import { useCatalog, useCatalogIndex, useLiveStatus, useSession } from '../lib/queries';

type Filter = 'all' | 'available' | 'busy' | 'down';

const MATCHES: Record<Filter, (s: LiveState | undefined) => boolean> = {
  all: () => true,
  available: (s) => s === 'available',
  busy: (s) => s === 'in-use' || s === 'requested',
  down: (s) => s === 'maintenance',
};

const ZOOM_LEVELS = [1, 1.35, 1.75];
const glass = 'rounded-card border border-white/70 bg-white/75 shadow-raised backdrop-blur-md';

/** Live isometric campus: department buildings, equipment pins, and the route from your department. */
export function MapPage() {
  const catalog = useCatalog();
  const index = useCatalogIndex();
  const { byId: live } = useLiveStatus();
  const { data: session } = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const listRefs = useRef(new Map<string, HTMLButtonElement>());

  // Every catalogue item gets a fixed pin slot on its department's roof.
  const pins = useMemo(() => {
    const equipment = catalog.data?.equipment ?? [];
    return BUILDINGS.flatMap((b) => {
      const inBuilding = equipment.filter((e) => e.departmentId === b.departmentId);
      return roofPins(b, inBuilding.length).map((pos, i) => ({
        equipment: inBuilding[i] as Equipment,
        building: b,
        ...pos,
      }));
    });
  }, [catalog.data]);

  if (catalog.isPending) return <Loading label="Loading campus map" />;
  if (catalog.isError)
    return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const visible = pins.filter((p) => MATCHES[filter](live.get(p.equipment.id)?.state));
  const selected = selectedId ? index.equipment.get(selectedId) : undefined;
  const activeBuilding = BUILDINGS.find(
    (b) => b.departmentId === (selected?.departmentId ?? buildingId),
  );
  const home = BUILDINGS.find((b) => b.departmentId === session?.persona?.departmentId);
  const route = selected && home && activeBuilding ? routeBetween(home, activeBuilding) : [];
  const stems: PinStem[] = visible.map((p) => ({ id: p.equipment.id, base: p.base, head: p.head }));

  const states = [...live.values()].map((s) => s.state);
  const count = (match: (s: LiveState) => boolean) => states.filter(match).length;

  const selectEquipment = (id: string, fromMap = false) => {
    setSelectedId(id);
    setBuildingId(null);
    if (fromMap)
      listRefs.current.get(id)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };
  const selectBuilding = (departmentId: string) => {
    setBuildingId(departmentId);
    setSelectedId(null);
  };
  const closePanel = () => {
    setSelectedId(null);
    setBuildingId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Campus map</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live status of every shared instrument. Select one to see the walking route from your
            department.
          </p>
        </div>
        <Segmented<Filter>
          label="Show equipment"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'available', label: 'Available' },
            { value: 'busy', label: 'Busy' },
            { value: 'down', label: 'Down' },
          ]}
        />
      </header>

      <div className="card relative overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50">
        <div className="grid lg:grid-cols-[300px_1fr]">
          {/* List: the complete, keyboard-first equivalent of the map. */}
          <section
            aria-labelledby="map-list-title"
            className="relative z-10 border-b border-white/70 bg-white/70 backdrop-blur-md lg:border-b-0 lg:border-r"
          >
            <div className="border-b border-slate-200/70 px-4 py-3">
              <h2 id="map-list-title" className="card-title">
                Equipment
              </h2>
              <p className="text-xs text-slate-500">{visible.length} shown</p>
            </div>
            <ul className="max-h-72 divide-y divide-slate-200/60 overflow-y-auto lg:max-h-[38rem]">
              {visible.map(({ equipment: e }) => {
                const active = e.id === selectedId;
                return (
                  <li key={e.id}>
                    <button
                      ref={(el) => {
                        if (el) listRefs.current.set(e.id, el);
                        else listRefs.current.delete(e.id);
                      }}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectEquipment(e.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-brand-50/90' : 'hover:bg-white/80'}`}
                    >
                      <CategoryIcon category={e.category} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {e.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {index.labs.get(e.labId)?.name}
                        </span>
                        <span className="mt-1.5 block">
                          <LiveStatusPill status={live.get(e.id)} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-500">
                  No equipment in this state right now.
                </li>
              )}
            </ul>
          </section>

          {/* Below 2xl the detail panel flows under the scene; at 2xl+ it floats over a padded scene. */}
          <div className="relative flex min-w-0 flex-col">
            <div className="relative">
              {/* Scrollable, zoomable stage. */}
              <div
                className={`overflow-auto transition-[padding] duration-300 ${activeBuilding ? '2xl:pr-[19rem]' : ''}`}
              >
                <div
                  role="group"
                  aria-label="Campus map"
                  className="relative mx-auto transition-[width] duration-300"
                  style={{
                    width: `${(ZOOM_LEVELS[zoom] ?? 1) * 100}%`,
                    aspectRatio: `${VIEWBOX.w} / ${VIEWBOX.h}`,
                  }}
                >
                  <IsoCampus
                    selectedDepartmentId={activeBuilding?.departmentId ?? null}
                    homeDepartmentId={home?.departmentId ?? null}
                    route={route}
                    stems={stems}
                    onSelectBuilding={selectBuilding}
                  />

                  {BUILDINGS.map((b) => (
                    <BuildingLabel
                      key={b.departmentId}
                      building={b}
                      count={pins.filter((p) => p.building === b).length}
                      active={b.departmentId === activeBuilding?.departmentId}
                      isHome={b.departmentId === home?.departmentId}
                      onSelect={() => selectBuilding(b.departmentId)}
                    />
                  ))}

                  {visible.map(({ equipment: e, head, building }) => {
                    const status = live.get(e.id);
                    const fill = status ? LIVE_STYLE[status.state].fill : '#94a3b8';
                    const active = e.id === selectedId;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${e.name}, ${index.labs.get(e.labId)?.name}: ${status ? liveStatusText(status) : 'status loading'}`}
                        title={`${e.name} · ${building.name}`}
                        onClick={() => selectEquipment(e.id, true)}
                        className={`absolute z-10 grid h-4 w-4 -translate-x-1/2 sm:h-6 sm:w-6 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 ${
                          active ? 'z-20 scale-125 ring-4 ring-brand-600/30' : ''
                        }`}
                        style={{ ...toPercent(head), backgroundColor: fill }}
                      >
                        {status?.state === 'available' && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full motion-safe:animate-pin-pulse"
                            style={{ backgroundColor: fill }}
                          />
                        )}
                        <span
                          aria-hidden="true"
                          className="relative hidden h-1.5 w-1.5 rounded-full bg-white sm:block"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fixed overlays (not scaled by zoom). */}
              <dl
                className={`${glass} pointer-events-none absolute left-3 top-3 hidden gap-5 px-4 py-2.5 sm:flex`}
              >
                <Stat
                  label="Available now"
                  value={count((s) => s === 'available')}
                  color={LIVE_STYLE.available.fill}
                />
                <Stat
                  label="In use / requested"
                  value={count((s) => s === 'in-use' || s === 'requested')}
                  color={LIVE_STYLE['in-use'].fill}
                />
                <Stat
                  label="Down"
                  value={count((s) => s === 'maintenance')}
                  color={LIVE_STYLE.maintenance.fill}
                />
              </dl>

              <div className={`${glass} absolute right-3 top-3 flex flex-col p-1`}>
                <button
                  type="button"
                  className="icon-btn h-8 w-8"
                  aria-label="Zoom in"
                  disabled={zoom === ZOOM_LEVELS.length - 1}
                  onClick={() => setZoom((z) => z + 1)}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="icon-btn h-8 w-8"
                  aria-label="Zoom out"
                  disabled={zoom === 0}
                  onClick={() => setZoom((z) => z - 1)}
                >
                  <Minus aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <ul
                className={`${glass} absolute bottom-3 left-3 hidden flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs text-slate-700 md:flex`}
                aria-label="Map legend"
              >
                {(['available', 'requested', 'in-use', 'closed', 'maintenance'] as LiveState[]).map(
                  (s) => (
                    <li key={s} className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: LIVE_STYLE[s].fill }}
                      />
                      {LIVE_STYLE[s].label}
                    </li>
                  ),
                )}
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-0.5 w-4 rounded bg-brand-700" />
                  Your route
                </li>
              </ul>
            </div>

            {activeBuilding && (
              <BuildingPanel
                building={activeBuilding}
                home={home}
                selected={selected}
                equipment={pins
                  .filter((p) => p.building === activeBuilding)
                  .map((p) => p.equipment)}
                live={live}
                labName={(labId) => index.labs.get(labId)?.name ?? ''}
                labLocation={(labId) => index.labs.get(labId)?.location ?? ''}
                onSelect={(id) => selectEquipment(id, true)}
                onClose={closePanel}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-2xs text-slate-600">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label}
      </dt>
      <dd className="metric text-xl">{value}</dd>
    </div>
  );
}

function BuildingLabel({
  building,
  count,
  active,
  isHome,
  onSelect,
}: {
  building: Building;
  count: number;
  active: boolean;
  isHome: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${building.name}${isHome ? ' (your department)' : ''}, ${count} item${count === 1 ? '' : 's'}`}
      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] sm:px-2.5 sm:py-1 sm:text-2xs font-semibold shadow-sm backdrop-blur transition-colors ${
        active
          ? 'border-brand-600 bg-brand-700 text-white'
          : 'border-white/80 bg-white/85 text-ink hover:bg-white'
      }`}
      style={toPercent(labelPoint(building))}
    >
      {building.name}
      {isHome && (
        <span className={`ml-1.5 ${active ? 'text-blue-100' : 'text-brand-700'}`}>· You</span>
      )}
    </button>
  );
}

interface BuildingPanelProps {
  building: Building;
  home: Building | undefined;
  selected: Equipment | undefined;
  equipment: Equipment[];
  live: Map<string, LiveStatus>;
  labName: (labId: string) => string;
  labLocation: (labId: string) => string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Frosted detail panel: the selected building's equipment, plus the selected item and its route. */
function BuildingPanel({
  building,
  home,
  selected,
  equipment,
  live,
  labName,
  labLocation,
  onSelect,
  onClose,
}: BuildingPanelProps) {
  const states = equipment.map((e) => live.get(e.id)?.state);
  const segments: { label: string; count: number; color: string }[] = [
    {
      label: 'Available',
      count: states.filter((s) => s === 'available').length,
      color: LIVE_STYLE.available.fill,
    },
    {
      label: 'Busy',
      count: states.filter((s) => s === 'in-use' || s === 'requested').length,
      color: LIVE_STYLE['in-use'].fill,
    },
    {
      label: 'Closed',
      count: states.filter((s) => s === 'closed').length,
      color: LIVE_STYLE.closed.fill,
    },
    {
      label: 'Down',
      count: states.filter((s) => s === 'maintenance').length,
      color: LIVE_STYLE.maintenance.fill,
    },
  ];
  const sameBuilding = home?.departmentId === building.departmentId;

  return (
    <aside
      aria-label={selected ? `${selected.name} details` : `${building.name} details`}
      aria-live="polite"
      className={`${glass} relative z-30 m-3 flex max-h-[30rem] 2xl:absolute 2xl:bottom-3 2xl:right-3 2xl:m-0 2xl:max-h-[70%] 2xl:w-72 animate-fade-in flex-col overflow-hidden`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">{building.name}</p>
          <p className="text-xs text-slate-500">
            {equipment.length} shared item{equipment.length === 1 ? '' : 's'}
            {sameBuilding && ' · your department'}
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
          <div className="border-b border-slate-200/70 bg-white/60 px-4 py-3">
            <div className="flex items-start gap-3">
              <CategoryIcon category={selected.category} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{selected.name}</p>
                <p className="text-xs text-slate-500">{labLocation(selected.labId)}</p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <LiveStatusPill status={live.get(selected.id)} />
              {selected.status === 'operational' && (
                <ApprovalBadge requiresApproval={selected.requiresApproval} />
              )}
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-600">
              <Footprints
                aria-hidden="true"
                className="mt-px h-3.5 w-3.5 shrink-0 text-brand-700"
              />
              {sameBuilding || !home
                ? 'In your own department building.'
                : `Route shown: ${home.name} → ${building.name}, via the central avenue.`}
            </p>
            <Link to={`/equipment/${selected.id}`} className="btn-primary mt-3 w-full">
              {selected.status === 'operational' ? 'View availability & book' : 'View details'}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        )}

        <div className="px-4 py-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
            {segments.map((s) => (
              <span
                key={s.label}
                style={{
                  width: `${(s.count / Math.max(1, equipment.length)) * 100}%`,
                  backgroundColor: s.color,
                }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-2xs text-slate-600">
            {segments
              .filter((s) => s.count > 0)
              .map((s) => `${s.count} ${s.label.toLowerCase()}`)
              .join(' · ')}
          </p>
        </div>

        <ul className="divide-y divide-slate-200/60 border-t border-slate-200/70">
          {equipment.map((e) => {
            const status = live.get(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  aria-pressed={e.id === selected?.id}
                  onClick={() => onSelect(e.id)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${e.id === selected?.id ? 'bg-brand-50/90' : 'hover:bg-white/70'}`}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: status ? LIVE_STYLE[status.state].fill : '#94a3b8' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{e.name}</span>
                    <span className="block truncate text-2xs text-slate-500">
                      {labName(e.labId)} · {status ? liveStatusText(status) : '…'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
