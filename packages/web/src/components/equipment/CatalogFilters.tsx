import { EQUIPMENT_CATEGORIES, type Department } from '@lablink/shared';
import { Search } from 'lucide-react';
import { useId } from 'react';
import type { Availability, CatalogFilter } from '../../lib/catalogFilters';

interface Props {
  filter: CatalogFilter;
  departments: readonly Department[];
  onChange: (next: CatalogFilter) => void;
}

/** Keyword, department, category and availability filters for the catalogue. */
export function CatalogFilters({ filter, departments, onChange }: Props) {
  const ids = { text: useId(), dept: useId(), cat: useId(), avail: useId() };
  const set = (patch: Partial<CatalogFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="grid gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative">
        <label htmlFor={ids.text} className="sr-only">
          Filter by keyword
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        />
        <input
          id={ids.text}
          className="field pl-9"
          value={filter.keyword}
          onChange={(e) => set({ keyword: e.target.value })}
          placeholder="Filter: fpga, pcr, laser…"
        />
      </div>
      <div>
        <label htmlFor={ids.dept} className="sr-only">
          Department
        </label>
        <select
          id={ids.dept}
          className="field"
          value={filter.department}
          onChange={(e) => set({ department: e.target.value })}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.cat} className="sr-only">
          Category
        </label>
        <select
          id={ids.cat}
          className="field"
          value={filter.category}
          onChange={(e) => set({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {EQUIPMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={ids.avail} className="sr-only">
          Availability
        </label>
        <select
          id={ids.avail}
          className="field"
          value={filter.availability}
          onChange={(e) => set({ availability: e.target.value as Availability })}
        >
          <option value="">Any availability</option>
          <option value="now">Available right now</option>
          <option value="instant">Instant booking (no approval)</option>
        </select>
      </div>
    </div>
  );
}
