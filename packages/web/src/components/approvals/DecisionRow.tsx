import { formatSlot, type AllocationDecision, type ScoredBooking } from '@lablink/shared';
import { ArrowRight, Check, X } from 'lucide-react';
import { useCatalogIndex } from '../../lib/queries';
import { ScoreBreakdown, ScorePill } from '../ScoreBreakdown';

interface DecisionRowProps {
  decision: AllocationDecision;
  booking: ScoredBooking | undefined;
  conflictEquipmentId: string;
  /** Gemini's personal message for this student, when an explanation was requested. */
  message?: string;
}

/** One ranked contender in a conflict: score, outcome and the reasons behind it. */
export function DecisionRow({ decision, booking, conflictEquipmentId, message }: DecisionRowProps) {
  return (
    <li className="grid gap-4 p-5 md:grid-cols-[auto_1fr_1fr] md:items-start">
      <div className="flex items-center gap-3 md:flex-col md:items-center">
        <span className="text-xs font-semibold text-slate-500">#{decision.rank}</span>
        <ScorePill score={decision.score} />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{booking?.userName}</p>
        <p className="text-sm text-slate-700">{booking?.project.title}</p>
        {booking && (
          <p className="text-sm text-slate-600">
            Requested {formatSlot(booking.slot)} · deadline {booking.project.deadline}
          </p>
        )}
        <div className="pt-2">
          <OutcomeChip decision={decision} conflictEquipmentId={conflictEquipmentId} />
        </div>
        {message && <p className="pt-2 text-sm italic text-violet-900">“{message}”</p>}
      </div>
      <div className="space-y-2">
        <ScoreBreakdown score={decision.score} />
        <ul className="list-inside list-disc text-xs text-slate-600">
          {decision.score.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function OutcomeChip({
  decision,
  conflictEquipmentId,
}: {
  decision: AllocationDecision;
  conflictEquipmentId: string;
}) {
  const index = useCatalogIndex();
  const move = decision.alternatives[0];
  if (decision.outcome === 'allocate') {
    return (
      <span className="chip border-emerald-200 bg-emerald-50 text-emerald-800">
        <Check aria-hidden="true" className="h-3.5 w-3.5" /> Keeps requested slot
      </span>
    );
  }
  if (!move) {
    return (
      <span className="chip border-rose-200 bg-rose-50 text-rose-800">
        <X aria-hidden="true" className="h-3.5 w-3.5" /> No feasible alternative
      </span>
    );
  }
  const where =
    move.equipmentId === conflictEquipmentId
      ? 'same equipment'
      : index.equipment.get(move.equipmentId)?.name;
  return (
    <span className="chip border-brand-200 bg-brand-50 text-brand-800">
      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      Move to {where}, {formatSlot(move.slot)}
    </span>
  );
}
