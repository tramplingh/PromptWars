import type { Equipment, LiveState } from '@lablink/shared';
import { ArrowRight, MapPin, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApprovalBadge } from '../components/Badges';
import { CategoryIcon } from '../components/CategoryIcon';
import { ErrorState, Loading } from '../components/States';
import { LIVE_STYLE, LiveStatusPill, liveStatusText } from '../components/ui/LiveStatusPill';
import { Segmented } from '../components/ui/Segmented';
import {
  BUILDINGS,
  LAB_ROOMS,
  MAP_HEIGHT,
  MAP_WIDTH,
  WALKWAYS,
  pinPositions,
} from '../lib/campusLayout';
import { useCatalog, useCatalogIndex, useLiveStatus } from '../lib/queries';

type Filter = 'all' | 'available' | 'busy' | 'down';

const MATCHES: Record<Filter, (s: LiveState | undefined) => boolean> = {
  all: () => true,
  available: (s) => s === 'available',
  busy: (s) => s === 'in-use' || s === 'requested',
  down: (s) => s === 'maintenance',
};

const BUILDING_TONE = {
  blue: { fill: '#eff6ff', stroke: '#2563eb' },
  violet: { fill: '#f5f3ff', stroke: '#7c3aed' },
  pink: { fill: '#fdf2f8', stroke: '#db2777' },
  amber: { fill: '#fffbeb', stroke: '#d97706' },
  green: { fill: '#f0fdf4', stroke: '#16a34a' },
} as const;

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

/** Live campus map: department buildings as zones, equipment as status-coloured pins. */
export function MapPage() {
  const catalog = useCatalog();
  const index = useCatalogIndex();
  const { byId: live } = useLiveStatus();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRefs = useRef(new Map<string, HTMLButtonElement>());

  const pins = useMemo(() => {
    const equipment = catalog.data?.equipment ?? [];
    return Object.entries(LAB_ROOMS).flatMap(([labId, room]) => {
      const inLab = equipment.filter((e) => e.labId === labId);
      return pinPositions(room, inLab.length).map((pos, i) => ({
        equipment: inLab[i] as Equipment,
        ...pos,
      }));
    });
  }, [catalog.data]);

  if (catalog.isPending) return <Loading label="Loading campus map" />;
  if (catalog.isError)
    return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const visible = pins.filter((p) => MATCHES[filter](live.get(p.equipment.id)?.state));
  const selected = selectedId ? index.equipment.get(selectedId) : undefined;
  const states = [...live.values()].map((s) => s.state);
  const summary: [string, number][] = [
    ['Total assets', catalog.data.equipment.length],
    ['Available now', states.filter((s) => s === 'available').length],
    ['In use / requested', states.filter((s) => s === 'in-use' || s === 'requested').length],
    ['Down', states.filter((s) => s === 'maintenance').length],
  ];

  const select = (id: string, fromMap = false) => {
    setSelectedId(id);
    if (fromMap)
      listRefs.current.get(id)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Campus map</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live status of every shared instrument, by building and lab.
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

      <div className="card overflow-hidden">
        <dl className="flex flex-wrap divide-x divide-slate-200 border-b border-slate-200">
          {summary.map(([label, value]) => (
            <div key={label} className="px-5 py-2.5">
              <dt className="text-2xs text-slate-500">{label}</dt>
              <dd className="metric text-lg">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid lg:grid-cols-[320px_1fr]">
          {/* List: the fully accessible equivalent of the map. */}
          <section
            aria-labelledby="map-list-title"
            className="border-b border-slate-200 lg:border-b-0 lg:border-r"
          >
            <h2 id="map-list-title" className="sr-only">
              Equipment list
            </h2>
            <ul className="max-h-[34rem] divide-y divide-slate-100 overflow-y-auto">
              {visible.map(({ equipment: e }) => {
                const status = live.get(e.id);
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
                      onClick={() => select(e.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
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
                          <LiveStatusPill status={status} />
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

          <div className="relative bg-slate-100/70 p-3 sm:p-5">
            <div
              role="group"
              aria-label="Campus map"
              className="relative mx-auto w-full"
              style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}
            >
              <svg
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <rect width={MAP_WIDTH} height={MAP_HEIGHT} rx="12" fill="#eef2f6" />
                {WALKWAYS.map((d) => (
                  <path key={d} d={d} stroke="#ffffff" strokeWidth="18" fill="none" />
                ))}
                {BUILDINGS.map((b) => {
                  const tone = BUILDING_TONE[b.tone];
                  return (
                    <g key={b.departmentId}>
                      <polygon
                        points={b.points}
                        fill={tone.fill}
                        stroke={tone.stroke}
                        strokeWidth="1.5"
                      />
                      <text
                        x={b.label.x}
                        y={b.label.y}
                        fontSize="15"
                        fontWeight="600"
                        fill="#0f172a"
                      >
                        {b.name}
                      </text>
                    </g>
                  );
                })}
                {Object.entries(LAB_ROOMS).map(([labId, room]) => (
                  <g key={labId}>
                    <rect
                      x={room.x}
                      y={room.y}
                      width={room.w}
                      height={room.h}
                      rx="8"
                      fill="#ffffff"
                      stroke="#cbd5e1"
                      strokeDasharray="4 3"
                    />
                    <text x={room.x + 10} y={room.y + 20} fontSize="12" fill="#475569">
                      {index.labs.get(labId)?.name}
                    </text>
                  </g>
                ))}
              </svg>

              {visible.map(({ equipment: e, x, y }) => {
                const status = live.get(e.id);
                const fill = status ? LIVE_STYLE[status.state].fill : '#94a3b8';
                const active = e.id === selectedId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${e.name}, ${index.labs.get(e.labId)?.name}: ${status ? liveStatusText(status) : 'status loading'}`}
                    title={e.name}
                    onClick={() => select(e.id, true)}
                    className={`absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-110 sm:h-8 sm:w-8 ${
                      active ? 'z-10 scale-125 ring-4 ring-brand-600/30' : ''
                    }`}
                    style={{
                      left: pct(x, MAP_WIDTH),
                      top: pct(y, MAP_HEIGHT),
                      backgroundColor: fill,
                    }}
                  >
                    <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-white" />
                  </button>
                );
              })}
            </div>

            <ul
              className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600"
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
            </ul>

            {selected && (
              <div
                role="region"
                aria-label={`${selected.name} details`}
                aria-live="polite"
                className="absolute left-4 top-4 z-20 w-72 max-w-[calc(100%-2rem)] animate-fade-in rounded-card border border-slate-200 bg-white p-4 shadow-raised sm:left-7 sm:top-7"
              >
                <div className="flex items-start gap-3">
                  <CategoryIcon category={selected.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{selected.name}</p>
                    <p className="text-xs text-slate-500">
                      {index.labs.get(selected.labId)?.location}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn -mr-2 -mt-2 h-8 w-8"
                    aria-label="Close details"
                    onClick={() => setSelectedId(null)}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <LiveStatusPill status={live.get(selected.id)} />
                  {selected.status === 'operational' && (
                    <ApprovalBadge requiresApproval={selected.requiresApproval} />
                  )}
                </div>
                <Link to={`/equipment/${selected.id}`} className="btn-primary mt-4 w-full">
                  {selected.status === 'operational' ? 'View availability & book' : 'View details'}{' '}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
