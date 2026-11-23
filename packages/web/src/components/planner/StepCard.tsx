import { formatSlot, type PlannedStepView, type ProjectPlanResponse } from '@lablink/shared';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { prerequisiteNumbers } from '../../lib/planItems';
import { useCatalogIndex } from '../../lib/queries';
import { ApprovalBadge } from '../Badges';
import { CategoryIcon } from '../CategoryIcon';

interface Props {
  step: PlannedStepView;
  number: number;
  plan: ProjectPlanResponse;
  color: string;
}

/** One project step: what it needs, what it waits for, and where/when it was scheduled. */
export function StepCard({ step, number, plan, color }: Props) {
  const after = prerequisiteNumbers(plan, step.dependsOn);
  return (
    <li className="card flex gap-4 p-4">
      <span
        aria-hidden="true"
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${color}`}
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            <span className="sr-only">Step {number}: </span>
            {step.title}
          </h3>
          <p className="text-sm text-slate-600">{step.purpose}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {step.requirements.map((r) => (
              <span key={r} className="chip border-slate-200 bg-slate-50 text-slate-700">
                {r}
              </span>
            ))}
            <span>
              · {step.hours}h{after.length > 0 && ` · after step ${after.join(', ')}`}
            </span>
          </p>
        </div>
        <StepAssignment step={step} />
      </div>
    </li>
  );
}

function StepAssignment({ step }: { step: PlannedStepView }) {
  const index = useCatalogIndex();
  const schedule = step.schedule;
  if (schedule.status === 'unschedulable') {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {schedule.reason}
      </p>
    );
  }
  const equipment = index.equipment.get(schedule.equipmentId);
  if (!equipment) return null;
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <CategoryIcon category={equipment.category} size="sm" />
      <div className="min-w-0 flex-1">
        <Link
          to={`/equipment/${equipment.id}`}
          className="text-sm font-medium text-brand-800 hover:underline"
        >
          {equipment.name}
        </Link>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin aria-hidden="true" className="h-3 w-3" />{' '}
          {index.departments.get(equipment.departmentId)?.code} ·{' '}
          {index.labs.get(equipment.labId)?.name}
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {schedule.sessions.map((slot) => (
            <li
              key={`${slot.date}-${slot.startHour}`}
              className="chip border-brand-200 bg-white text-brand-800"
            >
              {formatSlot(slot)}
            </li>
          ))}
        </ul>
      </div>
      <ApprovalBadge requiresApproval={equipment.requiresApproval} />
    </div>
  );
}
