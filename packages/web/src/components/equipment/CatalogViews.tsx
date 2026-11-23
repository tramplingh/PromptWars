import type { Equipment, LiveStatus } from '@lablink/shared';
import { Link } from 'react-router-dom';
import { useCatalogIndex } from '../../lib/queries';
import { ApprovalBadge } from '../Badges';
import { CategoryIcon } from '../CategoryIcon';
import { EquipmentCard } from '../EquipmentCard';
import { LiveStatusPill } from '../ui/LiveStatusPill';

interface ViewProps {
  items: readonly Equipment[];
  live: ReadonlyMap<string, LiveStatus>;
}

export function CatalogGrid({ items, live }: ViewProps) {
  const index = useCatalogIndex();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
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
  );
}

export function CatalogTable({ items, live }: ViewProps) {
  const index = useCatalogIndex();
  return (
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
          {items.map((item) => (
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
              <td className="text-slate-700">{index.departments.get(item.departmentId)?.code}</td>
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
  );
}
