import type { Department, Equipment, Lab, LiveStatus } from '@lablink/shared';
import { MapPin, Sparkles } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ApprovalBadge } from './Badges';
import { CategoryIcon } from './CategoryIcon';
import { LiveStatusPill } from './ui/LiveStatusPill';

interface Props {
  equipment: Equipment;
  lab?: Lab;
  department?: Department;
  status?: LiveStatus;
  /** Optional AI explanation of why this item matches the user's need. */
  reason?: string;
}

export const EquipmentCard = memo(function EquipmentCard({
  equipment,
  lab,
  department,
  status,
  reason,
}: Props) {
  return (
    <article className="card group relative flex w-full flex-col p-4 transition-shadow hover:shadow-raised">
      <div className="flex items-start gap-3">
        <CategoryIcon category={equipment.category} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            {department?.code} · {equipment.category}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-ink">
            <Link
              to={`/equipment/${equipment.id}`}
              className="after:absolute after:inset-0 after:rounded-card focus:outline-none"
            >
              {equipment.name}
            </Link>
          </h3>
        </div>
      </div>

      {reason ? (
        <p className="mt-3 flex gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-950">
          <Sparkles aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
          {reason}
        </p>
      ) : (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{equipment.description}</p>
      )}

      <div className="mb-4 mt-3 flex flex-wrap gap-1.5">
        <LiveStatusPill status={status} />
        {equipment.status === 'operational' && (
          <ApprovalBadge requiresApproval={equipment.requiresApproval} />
        )}
      </div>

      <p className="mt-auto flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {lab?.location} · {equipment.units} unit{equipment.units > 1 ? 's' : ''}
        </span>
      </p>
    </article>
  );
});
