import type { Department, Equipment, Lab } from '@lablink/shared';
import { ArrowRight, MapPin, Wrench } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ApprovalBadge } from './Badges';
import { CategoryIcon } from './CategoryIcon';

interface Props {
  equipment: Equipment;
  lab?: Lab;
  department?: Department;
  /** Optional AI explanation of why this item matches the user's need. */
  reason?: string;
}

export const EquipmentCard = memo(function EquipmentCard({
  equipment,
  lab,
  department,
  reason,
}: Props) {
  const underMaintenance = equipment.status === 'maintenance';
  return (
    <article className="card group relative flex w-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start gap-3">
        <CategoryIcon category={equipment.category} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">
            <Link
              to={`/equipment/${equipment.id}`}
              className="after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
            >
              {equipment.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-600">
            {department?.code} · {equipment.category}
          </p>
        </div>
      </div>

      {reason ? (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900">{reason}</p>
      ) : (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{equipment.description}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {underMaintenance ? (
          <span className="chip border-rose-200 bg-rose-50 text-rose-800">
            <Wrench aria-hidden="true" className="h-3.5 w-3.5" /> Under maintenance
          </span>
        ) : (
          <ApprovalBadge requiresApproval={equipment.requiresApproval} />
        )}
        <span className="chip border-slate-200 bg-slate-50 text-slate-700">
          {equipment.units} unit{equipment.units > 1 ? 's' : ''}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 text-sm text-slate-600">
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="truncate">{lab?.location}</span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-brand-600 transition group-hover:translate-x-0.5"
        />
      </div>
    </article>
  );
});
