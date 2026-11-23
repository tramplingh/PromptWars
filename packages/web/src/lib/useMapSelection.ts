import type { Equipment, LiveState } from '@lablink/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import { BUILDINGS, roofPins, routeBetween, type Building, type Point } from './campusLayout';

export type MapFilter = 'all' | 'available' | 'busy' | 'down';

export const FILTER_MATCHES: Record<MapFilter, (s: LiveState | undefined) => boolean> = {
  all: () => true,
  available: (s) => s === 'available',
  busy: (s) => s === 'in-use' || s === 'requested',
  down: (s) => s === 'maintenance',
};

export interface MapPin {
  equipment: Equipment;
  building: Building;
  base: Point;
  head: Point;
}

/** Every catalogue item gets a fixed pin slot on its department's roof. */
export function buildPins(equipment: readonly Equipment[]): MapPin[] {
  return BUILDINGS.flatMap((building) => {
    const inBuilding = equipment.filter((e) => e.departmentId === building.departmentId);
    return roofPins(building, inBuilding.length).flatMap((pos, i) => {
      const item = inBuilding[i];
      return item ? [{ equipment: item, building, ...pos }] : [];
    });
  });
}

/**
 * Selection state for the campus map: a selected item or building, the
 * building panel to show, the walking route from the viewer's department, and
 * a registry of list buttons so map clicks can scroll the list into sync.
 */
export function useMapSelection(
  selectedItem: (id: string) => Equipment | undefined,
  homeDepartmentId: string | undefined,
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const listRefs = useRef(new Map<string, HTMLButtonElement>());

  const selected = selectedId ? selectedItem(selectedId) : undefined;
  const activeBuilding = BUILDINGS.find(
    (b) => b.departmentId === (selected?.departmentId ?? buildingId),
  );
  const home = BUILDINGS.find((b) => b.departmentId === homeDepartmentId);
  const route = useMemo(
    () => (selected && home && activeBuilding ? routeBetween(home, activeBuilding) : []),
    [selected, home, activeBuilding],
  );

  const selectEquipment = useCallback((id: string, fromMap = false) => {
    setSelectedId(id);
    setBuildingId(null);
    if (fromMap)
      listRefs.current.get(id)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const selectBuilding = useCallback((departmentId: string) => {
    setBuildingId(departmentId);
    setSelectedId(null);
  }, []);
  const clear = useCallback(() => {
    setSelectedId(null);
    setBuildingId(null);
  }, []);
  const registerListItem = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) listRefs.current.set(id, el);
    else listRefs.current.delete(id);
  }, []);

  return {
    selected,
    activeBuilding,
    home,
    route,
    selectEquipment,
    selectBuilding,
    clear,
    registerListItem,
  };
}
