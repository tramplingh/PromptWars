import { useMemo, useState } from 'react';
import { BuildingPanel } from '../components/map/BuildingPanel';
import { CampusStage } from '../components/map/CampusStage';
import { MapEquipmentList } from '../components/map/MapEquipmentList';
import { MapLegend, MapStats, ZoomControls } from '../components/map/MapOverlays';
import { ErrorState, Loading } from '../components/States';
import { Segmented } from '../components/ui/Segmented';
import { summariseLive } from '../lib/catalogFilters';
import { useCatalog, useCatalogIndex, useLiveStatus, useSession } from '../lib/queries';
import { FILTER_MATCHES, buildPins, useMapSelection, type MapFilter } from '../lib/useMapSelection';

const ZOOM_LEVELS = [1, 1.35, 1.75];
const FILTERS: { value: MapFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'down', label: 'Down' },
];

/** Live isometric campus: department buildings, equipment pins, and the route from your department. */
export function MapPage() {
  const catalog = useCatalog();
  const index = useCatalogIndex();
  const { byId: live } = useLiveStatus();
  const { data: session } = useSession();
  const [filter, setFilter] = useState<MapFilter>('all');
  const [zoom, setZoom] = useState(0);
  const map = useMapSelection((id) => index.equipment.get(id), session?.persona?.departmentId);
  const pins = useMemo(() => buildPins(catalog.data?.equipment ?? []), [catalog.data]);
  const summary = useMemo(() => summariseLive(live.values()), [live]);

  if (catalog.isPending) return <Loading label="Loading campus map" />;
  if (catalog.isError)
    return <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const visible = pins.filter((p) => FILTER_MATCHES[filter](live.get(p.equipment.id)?.state));
  const { selected, activeBuilding } = map;

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
        <Segmented<MapFilter>
          label="Show equipment"
          value={filter}
          onChange={setFilter}
          options={FILTERS}
        />
      </header>

      <div className="card relative overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50">
        <div className="grid lg:grid-cols-[300px_1fr]">
          <MapEquipmentList
            pins={visible}
            live={live}
            selectedId={selected?.id}
            onSelect={map.selectEquipment}
            register={map.registerListItem}
          />

          {/* Below 2xl the detail panel flows under the scene; at 2xl+ it floats over a padded scene. */}
          <div className="relative flex min-w-0 flex-col">
            <div className="relative">
              <div
                className={`overflow-auto transition-[padding] duration-300 ${activeBuilding ? '2xl:pr-[19rem]' : ''}`}
              >
                <CampusStage
                  zoom={ZOOM_LEVELS[zoom] ?? 1}
                  pins={pins}
                  visible={visible}
                  live={live}
                  selectedId={selected?.id}
                  activeBuilding={activeBuilding}
                  home={map.home}
                  route={map.route}
                  onSelectEquipment={(id) => map.selectEquipment(id, true)}
                  onSelectBuilding={map.selectBuilding}
                />
              </div>
              <MapStats summary={summary} />
              <ZoomControls level={zoom} max={ZOOM_LEVELS.length - 1} onChange={setZoom} />
              <MapLegend />
            </div>

            {activeBuilding && (
              <BuildingPanel
                building={activeBuilding}
                home={map.home}
                selected={selected}
                equipment={pins
                  .filter((p) => p.building === activeBuilding)
                  .map((p) => p.equipment)}
                live={live}
                onSelect={(id) => map.selectEquipment(id, true)}
                onClose={map.clear}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
