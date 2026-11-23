import {
  formatHour,
  type Department,
  type Equipment,
  type Lab,
  type LiveStatus,
} from '@lablink/shared';
import { Clock, MapPin, Timer, Users } from 'lucide-react';
import { ApprovalBadge } from '../Badges';
import { CategoryIcon } from '../CategoryIcon';
import { LiveStatusPill } from '../ui/LiveStatusPill';

interface Props {
  equipment: Equipment;
  lab: Lab;
  department: Department;
  status: LiveStatus | undefined;
}

/** Device title, description, capabilities, live status and a key-facts strip. */
export function EquipmentHeader({ equipment, lab, department, status }: Props) {
  const facts = [
    { icon: MapPin, label: 'Location', value: `${lab.name}, ${lab.location}` },
    {
      icon: Clock,
      label: 'Opening hours',
      value: `${formatHour(lab.openHour)}–${formatHour(lab.closeHour)}, Mon–Fri`,
    },
    {
      icon: Users,
      label: 'Units',
      value: `${equipment.units} identical unit${equipment.units > 1 ? 's' : ''}`,
    },
    { icon: Timer, label: 'Max per booking', value: `${equipment.maxHoursPerBooking} hours` },
  ];
  return (
    <header className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <CategoryIcon category={equipment.category} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            {department.name} · {equipment.category}
          </p>
          <h1 className="page-title mt-1">{equipment.name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{equipment.description}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Capabilities">
            {equipment.capabilities.map((c) => (
              <li key={c} className="chip border-slate-200 bg-slate-50 text-slate-700">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-col sm:items-end">
          <LiveStatusPill status={status} />
          {equipment.status === 'operational' && (
            <ApprovalBadge requiresApproval={equipment.requiresApproval} />
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 divide-slate-200 border-t border-slate-200 bg-slate-50/60 sm:grid-cols-4 sm:divide-x">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0 px-5 py-3">
            <dt className="flex items-center gap-1.5 text-2xs text-slate-500">
              <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {label}
            </dt>
            <dd className="truncate text-sm font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
