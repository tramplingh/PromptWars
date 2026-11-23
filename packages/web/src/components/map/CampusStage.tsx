import type { LiveStatus } from '@lablink/shared';
import { useCatalogIndex } from '../../lib/queries';
import {
  BUILDINGS,
  VIEWBOX,
  labelPoint,
  toPercent,
  type Building,
  type Point,
} from '../../lib/campusLayout';
import type { MapPin } from '../../lib/useMapSelection';
import { LIVE_STYLE, liveStatusText } from '../ui/LiveStatusPill';
import { IsoCampus } from './IsoCampus';

const UNKNOWN_FILL = '#94a3b8';

interface StageProps {
  zoom: number;
  pins: MapPin[];
  visible: MapPin[];
  live: ReadonlyMap<string, LiveStatus>;
  selectedId: string | undefined;
  activeBuilding: Building | undefined;
  home: Building | undefined;
  route: Point[];
  onSelectEquipment: (id: string) => void;
  onSelectBuilding: (departmentId: string) => void;
}

/** The zoomable isometric scene with accessible building signs and equipment pins on top. */
export function CampusStage({
  zoom,
  pins,
  visible,
  live,
  selectedId,
  activeBuilding,
  home,
  route,
  onSelectEquipment,
  onSelectBuilding,
}: StageProps) {
  return (
    <div
      role="group"
      aria-label="Campus map"
      className="relative mx-auto transition-[width] duration-300"
      style={{ width: `${zoom * 100}%`, aspectRatio: `${VIEWBOX.w} / ${VIEWBOX.h}` }}
    >
      <IsoCampus
        selectedDepartmentId={activeBuilding?.departmentId ?? null}
        homeDepartmentId={home?.departmentId ?? null}
        route={route}
        stems={visible.map((p) => ({ id: p.equipment.id, base: p.base, head: p.head }))}
        onSelectBuilding={onSelectBuilding}
      />
      {BUILDINGS.map((b) => (
        <BuildingLabel
          key={b.departmentId}
          building={b}
          count={pins.filter((p) => p.building === b).length}
          active={b.departmentId === activeBuilding?.departmentId}
          isHome={b.departmentId === home?.departmentId}
          onSelect={() => onSelectBuilding(b.departmentId)}
        />
      ))}
      {visible.map((pin) => (
        <EquipmentPin
          key={pin.equipment.id}
          pin={pin}
          status={live.get(pin.equipment.id)}
          active={pin.equipment.id === selectedId}
          onSelect={() => onSelectEquipment(pin.equipment.id)}
        />
      ))}
    </div>
  );
}

function EquipmentPin({
  pin,
  status,
  active,
  onSelect,
}: {
  pin: MapPin;
  status: LiveStatus | undefined;
  active: boolean;
  onSelect: () => void;
}) {
  const index = useCatalogIndex();
  const { equipment, building, head } = pin;
  const fill = status ? LIVE_STYLE[status.state].fill : UNKNOWN_FILL;
  const statusText = status ? liveStatusText(status) : 'status loading';
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${equipment.name}, ${index.labs.get(equipment.labId)?.name}: ${statusText}`}
      title={`${equipment.name} · ${building.name}`}
      onClick={onSelect}
      className={`absolute z-10 grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 sm:h-6 sm:w-6 ${
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
  const tone = active
    ? 'border-brand-600 bg-brand-700 text-white'
    : 'border-white/80 bg-white/85 text-ink hover:bg-white';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold shadow-sm backdrop-blur transition-colors sm:px-2.5 sm:py-1 sm:text-2xs ${tone}`}
      style={toPercent(labelPoint(building))}
    >
      {building.name}
      {isHome && (
        <span className={`ml-1.5 ${active ? 'text-blue-100' : 'text-brand-700'}`}>
          · You<span className="sr-only"> (your department)</span>
        </span>
      )}
      <span className="sr-only">
        , {count} item{count === 1 ? '' : 's'}
      </span>
    </button>
  );
}
