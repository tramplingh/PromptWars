import type { LiveStatus } from '@lablink/shared';
import { useCatalogIndex } from '../../lib/queries';
import type { MapPin } from '../../lib/useMapSelection';
import { CategoryIcon } from '../CategoryIcon';
import { LiveStatusPill } from '../ui/LiveStatusPill';

interface Props {
  pins: MapPin[];
  live: ReadonlyMap<string, LiveStatus>;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  register: (id: string, el: HTMLButtonElement | null) => void;
}

/** The complete, keyboard-first text equivalent of the map, kept in sync with it. */
export function MapEquipmentList({ pins, live, selectedId, onSelect, register }: Props) {
  const index = useCatalogIndex();
  return (
    <section
      aria-labelledby="map-list-title"
      className="relative z-10 border-b border-white/70 bg-white/70 backdrop-blur-md lg:border-b-0 lg:border-r"
    >
      <div className="border-b border-slate-200/70 px-4 py-3">
        <h2 id="map-list-title" className="card-title">
          Equipment
        </h2>
        <p className="text-xs text-slate-500">{pins.length} shown</p>
      </div>
      <ul className="max-h-72 divide-y divide-slate-200/60 overflow-y-auto lg:max-h-[38rem]">
        {pins.map(({ equipment: e }) => {
          const active = e.id === selectedId;
          return (
            <li key={e.id}>
              <button
                ref={(el) => register(e.id, el)}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(e.id)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-brand-50/90' : 'hover:bg-white/80'}`}
              >
                <CategoryIcon category={e.category} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{e.name}</span>
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
        {pins.length === 0 && (
          <li className="px-4 py-6 text-sm text-slate-500">
            No equipment in this state right now.
          </li>
        )}
      </ul>
    </section>
  );
}
