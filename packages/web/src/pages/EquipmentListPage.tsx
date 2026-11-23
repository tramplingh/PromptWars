import { EQUIPMENT_CATEGORIES, type LiveState } from '@lablink/shared';
import { LayoutGrid, Rows3, Search } from 'lucide-react';
import { useDeferredValue, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AiSearchPanel } from '../components/AiSearchPanel';
import { ApprovalBadge } from '../components/Badges';
import { CategoryIcon } from '../components/CategoryIcon';
import { EquipmentCard } from '../components/EquipmentCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/States';
import { LiveStatusPill } from '../components/ui/LiveStatusPill';
import { Segmented } from '../components/ui/Segmented';
import { useCatalog, useCatalogIndex, useLiveStatus } from '../lib/queries';

type View = 'grid' | 'table';
type Availability = '' | 'now' | 'instant';

export function EquipmentListPage() {
  const catalog = useCatalog();
  const index = useCatalogIndex();
  const { byId: live } = useLiveStatus();
  const [params] = useSearchParams();
  const ask = params.get('ask') ?? undefined;

  const [view, setView] = useState<View>('grid');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState<Availability>('');
  const [text, setText] = useState('');
  const needle = useDeferredValue(text).trim().toLowerCase();
  const ids = { text: useId(), dept: useId(), cat: useId(), avail: useId() };

  const filtered = useMemo(() => {
    const isNow = (id: string) => (live.get(id)?.state as LiveState | undefined) === 'available';
    return (catalog.data?.equipment ?? []).filter(
      (e) =>
        (!department || e.departmentId === department) &&
        (!category || e.category === category) &&
        (availability !== 'now' || isNow(e.id)) &&
        (availability !== 'instant' || (!e.requiresApproval && e.status === 'operational')) &&
        (!needle ||
          `${e.name} ${e.description} ${e.capabilities.join(' ')}`.toLowerCase().includes(needle)),
    );
  }, [catalog.data, department, category, availability, needle, live]);

  const total = catalog.data?.equipment.length ?? 0;
  const counts = useMemo(() => {
    const states = [...live.values()].map((s) => s.state);
    return {
      available: states.filter((s) => s === 'available').length,
      inUse: states.filter((s) => s === 'in-use' || s === 'requested').length,
      down: states.filter((s) => s === 'maintenance').length,
    };
  }, [live]);

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
          {[
            ['Total assets', total],
            ['Available now', counts.available],
            ['In use / requested', counts.inUse],
            ['Down', counts.down],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-2">
              <dt className="text-2xs text-slate-500">{label}</dt>
              <dd className="metric text-lg">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <AiSearchPanel initialQuery={ask} compact />

      <section aria-labelledby="catalog-title" className="card">
        <div className="card-header">
          <div>
            <h2 id="catalog-title" className="card-title">
              Campus catalogue
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filtered.length} of {total}
            </p>
          </div>
          <Segmented<View>
            label="Layout"
            value={view}
            onChange={setView}
            options={[
              {
                value: 'grid',
                label: 'Grid',
                icon: <LayoutGrid aria-hidden="true" className="h-4 w-4" />,
              },
              {
                value: 'table',
                label: 'Table',
                icon: <Rows3 aria-hidden="true" className="h-4 w-4" />,
              },
            ]}
          />
        </div>

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
              value={text}
              onChange={(e) => setText(e.target.value)}
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
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {catalog.data?.departments.map((d) => (
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
              value={availability}
              onChange={(e) => setAvailability(e.target.value as Availability)}
            >
              <option value="">Any availability</option>
              <option value="now">Available right now</option>
              <option value="instant">Instant booking (no approval)</option>
            </select>
          </div>
        </div>

        <div className="p-5">
          {catalog.isPending ? (
            <SkeletonGrid />
          ) : catalog.isError ? (
            <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState title="Nothing matches these filters">
              Clear a filter or describe your need in the AI search above.
            </EmptyState>
          ) : view === 'grid' ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <li key={item.id} className="flex">
                  <EquipmentCard
                    equipment={item}
                    lab={index.labs.get(item.labId)}
                    department={index.departments.get(item.departmentId)}
                    status={live.get(item.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="-m-5 overflow-x-auto">
              <table className="data-table min-w-[48rem]">
                <caption className="sr-only">Equipment catalogue</caption>
                <thead>
                  <tr>
                    <th scope="col">Equipment</th>
                    <th scope="col">Department</th>
                    <th scope="col">Location</th>
                    <th scope="col">Status</th>
                    <th scope="col">Access</th>
                    <th scope="col" className="text-right">
                      Units
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <th scope="row" className="font-normal">
                        <span className="flex items-center gap-3">
                          <CategoryIcon category={item.category} size="sm" />
                          <Link
                            to={`/equipment/${item.id}`}
                            className="font-medium text-brand-800 hover:underline"
                          >
                            {item.name}
                          </Link>
                        </span>
                      </th>
                      <td className="text-slate-700">
                        {index.departments.get(item.departmentId)?.code}
                      </td>
                      <td className="text-slate-600">{index.labs.get(item.labId)?.location}</td>
                      <td>
                        <LiveStatusPill status={live.get(item.id)} />
                      </td>
                      <td>
                        <ApprovalBadge requiresApproval={item.requiresApproval} />
                      </td>
                      <td className="metric text-right">{item.units}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
