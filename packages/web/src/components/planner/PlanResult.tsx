import {
  formatHour,
  formatSlot,
  type BookingOutcome,
  type PlanBookingResult,
  type ProjectPlanResponse,
} from '@lablink/shared';
import { AlertTriangle, CalendarCheck2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { longDate } from '../../lib/format';
import { sessionCount, stepColor } from '../../lib/planItems';
import { useCatalogIndex } from '../../lib/queries';
import { AiSourceBadge } from '../Badges';
import { BusyIcon } from '../ui/BusyIcon';
import { PlanTimeline } from './PlanTimeline';
import { StepCard } from './StepCard';

interface Props {
  plan: ProjectPlanResponse;
  booking: boolean;
  booked: PlanBookingResult | null;
  onBook: () => void;
}

/** The proposed plan: summary and feasibility, timeline, ordered steps, then booking results. */
export function PlanResult({ plan, booking, booked, onBook }: Props) {
  const sessions = sessionCount(plan);
  return (
    <section aria-labelledby="plan-title" className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="plan-title" className="text-lg font-semibold">
                {plan.title}
              </h2>
              <AiSourceBadge source={plan.source} />
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{plan.summary}</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={sessions === 0 || booking || booked !== null}
            onClick={onBook}
          >
            <BusyIcon busy={booking} icon={CalendarCheck2} />
            {booked ? 'Booked' : `Book all ${sessions} session${sessions === 1 ? '' : 's'}`}
          </button>
        </div>
        <Feasibility plan={plan} sessions={sessions} />
      </div>

      <PlanTimeline plan={plan} />

      <ol className="space-y-3" aria-label="Plan steps in order">
        {plan.steps.map((step, i) => (
          <StepCard key={step.id} step={step} number={i + 1} plan={plan} color={stepColor(i)} />
        ))}
      </ol>

      {booked && <BookingResults result={booked} />}
    </section>
  );
}

function Feasibility({ plan, sessions }: { plan: ProjectPlanResponse; sessions: number }) {
  const unscheduled = plan.steps.filter((s) => s.schedule.status === 'unschedulable').length;
  const ok = plan.feasible && plan.finish;
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  const days = plan.slackDays ?? 0;
  const text =
    ok && plan.finish
      ? `Feasible: ${plan.steps.length} steps, ${sessions} sessions, finishing ${longDate(plan.finish.date)} at ${formatHour(plan.finish.hour)} — ${days} day${days === 1 ? '' : 's'} before your deadline.`
      : `${unscheduled} of ${plan.steps.length} steps can’t fit before ${longDate(plan.deadline)}. Book what fits, or move the deadline and plan again.`;
  return (
    <p
      className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </p>
  );
}

const OUTCOME: Record<
  BookingOutcome | 'failed',
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  confirmed: { label: 'Confirmed', className: 'text-emerald-700', icon: CheckCircle2 },
  'awaiting-approval': { label: 'Sent for approval', className: 'text-amber-700', icon: Clock },
  'queued-for-resolution': {
    label: 'Queued for fair resolution',
    className: 'text-violet-700',
    icon: Clock,
  },
  failed: { label: 'Not booked', className: 'text-rose-700', icon: XCircle },
};

function BookingResults({ result }: { result: PlanBookingResult }) {
  const index = useCatalogIndex();
  return (
    <section aria-labelledby="booked-title" className="card p-5">
      <h3 id="booked-title" className="card-title">
        Booking results
      </h3>
      <ul className="mt-3 divide-y divide-slate-100">
        {result.results.map((r) => {
          const o = OUTCOME[r.outcome];
          return (
            <li
              key={`${r.equipmentId}-${r.slot.date}-${r.slot.startHour}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
            >
              <o.icon aria-hidden="true" className={`h-4 w-4 ${o.className}`} />
              <span className="font-medium text-ink">
                {index.equipment.get(r.equipmentId)?.name}
              </span>
              <span className="text-slate-600">{formatSlot(r.slot)}</span>
              <span className={`ml-auto text-xs font-medium ${o.className}`}>
                {r.error ?? o.label}
              </span>
            </li>
          );
        })}
      </ul>
      <Link to="/bookings" className="btn-secondary mt-4">
        View my bookings
      </Link>
    </section>
  );
}
