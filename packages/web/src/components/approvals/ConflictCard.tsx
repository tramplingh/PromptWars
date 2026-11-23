import {
  formatHour,
  type AllocationPlan,
  type ConflictExplanation,
  type ScoredBooking,
} from '@lablink/shared';
import { CalendarClock, Check, Scale, Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '../../lib/api';
import { longDate } from '../../lib/format';
import { useApplyPlan, useCatalogIndex, useExplainConflict } from '../../lib/queries';
import { AiSourceBadge } from '../Badges';
import { useToast } from '../Toast';
import { BusyIcon } from '../ui/BusyIcon';
import { DecisionRow } from './DecisionRow';

/** A scheduling conflict with the engine's fair allocation, an AI explanation and one-click apply. */
export function ConflictCard({
  plan,
  pending,
}: {
  plan: AllocationPlan;
  pending: ScoredBooking[];
}) {
  const index = useCatalogIndex();
  const apply = useApplyPlan();
  const explain = useExplainConflict();
  const notify = useToast();
  const [explanation, setExplanation] = useState<ConflictExplanation | null>(null);
  const titleId = useId();

  const byId = new Map(pending.map((p) => [p.id, p]));
  const equipment = index.equipment.get(plan.conflict.equipmentId);
  const units = equipment?.units ?? 1;
  const onError = (error: unknown) => notify(errorMessage(error), 'error');

  const requestExplanation = () =>
    explain.mutate(plan.conflict.id, { onSuccess: setExplanation, onError });
  const applyPlan = () =>
    apply.mutate(plan.conflict.id, {
      onSuccess: ({ updated }) =>
        notify(
          `Fair allocation applied to ${updated.length} requests. Students have been updated.`,
        ),
      onError,
    });

  return (
    <article
      aria-labelledby={titleId}
      className="card overflow-hidden border-l-4 border-l-amber-500"
    >
      <p className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs text-slate-600">
        <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" /> Contested slot ·{' '}
        {longDate(plan.conflict.date)}, {formatHour(plan.conflict.startHour)}–
        {formatHour(plan.conflict.endHour)}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
        <div>
          <h3 id={titleId} className="font-semibold">
            {equipment?.name}
          </h3>
          <p className="text-sm text-slate-700">
            {plan.decisions.length} overlapping requests for {units} unit{units > 1 ? 's' : ''}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
            <Scale aria-hidden="true" className="h-4 w-4 text-brand-600" /> Recommendation:{' '}
            {plan.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={explain.isPending}
            onClick={requestExplanation}
          >
            <BusyIcon
              busy={explain.isPending}
              icon={Sparkles}
              className="h-4 w-4 text-violet-600"
            />
            Explain with AI
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={apply.isPending}
            onClick={applyPlan}
          >
            <BusyIcon busy={apply.isPending} icon={Check} />
            Apply fair allocation
          </button>
        </div>
      </div>

      {explanation && <FairnessExplanation explanation={explanation} />}

      <ol className="divide-y divide-slate-100">
        {plan.decisions.map((d) => (
          <DecisionRow
            key={d.bookingId}
            decision={d}
            booking={byId.get(d.bookingId)}
            conflictEquipmentId={plan.conflict.equipmentId}
            message={explanation?.perStudent.find((p) => p.bookingId === d.bookingId)?.message}
          />
        ))}
      </ol>
    </article>
  );
}

function FairnessExplanation({ explanation }: { explanation: ConflictExplanation }) {
  return (
    <div
      aria-live="polite"
      className="border-b border-violet-100 bg-violet-50 px-5 py-4 text-sm text-violet-950"
    >
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <Sparkles aria-hidden="true" className="h-4 w-4" /> Why this is fair{' '}
        <AiSourceBadge source={explanation.source} />
      </div>
      <p>{explanation.overview}</p>
    </div>
  );
}
