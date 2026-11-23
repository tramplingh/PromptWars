import type { AiSearchResponse } from '@lablink/shared';
import { X } from 'lucide-react';
import { useCatalogIndex, useLiveStatus } from '../lib/queries';
import { AiSourceBadge } from './Badges';
import { EquipmentCard } from './EquipmentCard';
import { EmptyState } from './States';

/** Ranked AI matches, each with the reason it fits the student's need. */
export function AiSearchResults({
  query,
  response,
  onClear,
}: {
  query: string;
  response: AiSearchResponse;
  onClear: () => void;
}) {
  const index = useCatalogIndex();
  const { byId: live } = useLiveStatus();
  return (
    <section aria-label={`Best matches for “${query}”`} className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Best matches for “{query}”</h3>
        <AiSourceBadge source={response.source} />
        <button type="button" className="btn-ghost ml-auto px-2 py-1 text-xs" onClick={onClear}>
          <X aria-hidden="true" className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
      {response.results.length === 0 ? (
        <EmptyState title="No close matches">
          Try describing the measurement or process you need, not the device name.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {response.results.map((r) => {
            const item = index.equipment.get(r.equipmentId);
            if (!item) return null;
            return (
              <li key={r.equipmentId} className="flex">
                <EquipmentCard
                  equipment={item}
                  lab={index.labs.get(item.labId)}
                  department={index.departments.get(item.departmentId)}
                  status={live.get(item.id)}
                  reason={r.reason}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
