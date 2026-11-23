import {
  formatHour,
  formatSlot,
  type AllocationPlan,
  type ConflictExplanation,
  type ScoredBooking,
} from '@lablink/shared';
import { ArrowRight, Check, GitCompareArrows, Loader2, Scale, Sparkles, X } from 'lucide-react';
import { useId, useState } from 'react';
import { AiSourceBadge } from '../components/Badges';
import { ScoreBreakdown, ScorePill } from '../components/ScoreBreakdown';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/api';
import { longDate, relativeTime } from '../lib/format';
import {
  useApplyPlan,
  useApprovals,
  useCatalogIndex,
  useDecision,
  useExplainConflict,
  useSession,
} from '../lib/queries';

export function ApprovalsPage() {
  const { data: session } = useSession();
  const persona = session?.persona;
  const queue = useApprovals(persona?.role === 'faculty' || persona?.role === 'admin');

  if (queue.isPending) return <Loading label="Loading approval queue" />;
  if (queue.isError) return <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />;

  const { conflicts, pending } = queue.data;
  const standalone = pending.filter((p) => !p.conflictId);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Approvals</h1>
        <p className="mt-1 text-slate-600">
          {persona?.role === 'admin'
            ? 'All departments'
            : 'Requests for equipment in your department'}{' '}
          · ranked by a transparent fair-share score.
        </p>
      </header>

      <section aria-labelledby="conflicts-title" className="space-y-4">
        <h2 id="conflicts-title" className="section-title flex items-center gap-2">
          <GitCompareArrows aria-hidden="true" className="h-5 w-5 text-amber-600" /> Scheduling
          conflicts ({conflicts.length})
        </h2>
        {conflicts.length === 0 ? (
          <EmptyState title="No conflicts right now">
            Overlapping requests will appear here with a recommended fair allocation.
          </EmptyState>
        ) : (
          conflicts.map((plan) => (
            <ConflictCard key={plan.conflict.id} plan={plan} pending={pending} />
          ))
        )}
      </section>

      <section aria-labelledby="pending-title" className="space-y-4">
        <h2 id="pending-title" className="section-title">
          Other pending requests ({standalone.length})
        </h2>
        {standalone.length === 0 ? (
          <EmptyState title="You’re all caught up" />
        ) : (
          <ul className="space-y-3">
            {standalone.map((b) => (
              <PendingRow key={b.id} booking={b} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConflictCard({ plan, pending }: { plan: AllocationPlan; pending: ScoredBooking[] }) {
  const index = useCatalogIndex();
  const apply = useApplyPlan();
  const explain = useExplainConflict();
  const notify = useToast();
  const [explanation, setExplanation] = useState<ConflictExplanation | null>(null);
  const titleId = useId();

  const byId = new Map(pending.map((p) => [p.id, p]));
  const equipment = index.equipment.get(plan.conflict.equipmentId);
  const messageFor = (bookingId: string) =>
    explanation?.perStudent.find((p) => p.bookingId === bookingId)?.message;

  return (
    <article aria-labelledby={titleId} className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-amber-50/60 p-5">
        <div>
          <h3 id={titleId} className="font-semibold">
            {equipment?.name}
          </h3>
          <p className="text-sm text-slate-700">
            {longDate(plan.conflict.date)} · {formatHour(plan.conflict.startHour)}–
            {formatHour(plan.conflict.endHour)} · {plan.decisions.length} overlapping requests for{' '}
            {equipment?.units} unit{equipment && equipment.units > 1 ? 's' : ''}
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
            onClick={() =>
              explain.mutate(plan.conflict.id, {
                onSuccess: setExplanation,
                onError: (error) => notify(errorMessage(error), 'error'),
              })
            }
          >
            {explain.isPending ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="h-4 w-4 text-violet-600" />
            )}
            Explain with AI
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={apply.isPending}
            onClick={() =>
              apply.mutate(plan.conflict.id, {
                onSuccess: ({ updated }) =>
                  notify(
                    `Fair allocation applied to ${updated.length} requests. Students have been updated.`,
                  ),
                onError: (error) => notify(errorMessage(error), 'error'),
              })
            }
          >
            {apply.isPending ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Check aria-hidden="true" className="h-4 w-4" />
            )}
            Apply fair allocation
          </button>
        </div>
      </div>

      {explanation && (
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
      )}

      <ol className="divide-y divide-slate-100">
        {plan.decisions.map((d) => {
          const booking = byId.get(d.bookingId);
          const alt = d.alternatives[0];
          const message = messageFor(d.bookingId);
          return (
            <li
              key={d.bookingId}
              className="grid gap-4 p-5 md:grid-cols-[auto_1fr_1fr] md:items-start"
            >
              <div className="flex items-center gap-3 md:flex-col md:items-center">
                <span className="text-xs font-semibold text-slate-500">#{d.rank}</span>
                <ScorePill score={d.score} />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">{booking?.userName}</p>
                <p className="text-sm text-slate-700">{booking?.project.title}</p>
                <p className="text-sm text-slate-600">
                  Requested {booking && formatSlot(booking.slot)} · deadline{' '}
                  {booking?.project.deadline}
                </p>
                <div className="pt-2">
                  {d.outcome === 'allocate' ? (
                    <span className="chip border-emerald-200 bg-emerald-50 text-emerald-800">
                      <Check aria-hidden="true" className="h-3.5 w-3.5" /> Keeps requested slot
                    </span>
                  ) : alt ? (
                    <span className="chip border-brand-200 bg-brand-50 text-brand-800">
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      Move to{' '}
                      {alt.equipmentId === plan.conflict.equipmentId
                        ? 'same equipment'
                        : index.equipment.get(alt.equipmentId)?.name}
                      , {formatSlot(alt.slot)}
                    </span>
                  ) : (
                    <span className="chip border-rose-200 bg-rose-50 text-rose-800">
                      <X aria-hidden="true" className="h-3.5 w-3.5" /> No feasible alternative
                    </span>
                  )}
                </div>
                {message && <p className="pt-2 text-sm italic text-violet-900">“{message}”</p>}
              </div>
              <div className="space-y-2">
                <ScoreBreakdown score={d.score} />
                <ul className="list-inside list-disc text-xs text-slate-600">
                  {d.score.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

function PendingRow({ booking }: { booking: ScoredBooking }) {
  const decide = useDecision();
  const notify = useToast();
  const [note, setNote] = useState('');
  const noteId = useId();

  const submit = (decision: 'approve' | 'reject') =>
    decide.mutate(
      { id: booking.id, decision, note },
      {
        onSuccess: () =>
          notify(
            decision === 'approve'
              ? `Approved ${booking.userName}’s request.`
              : `Declined ${booking.userName}’s request.`,
          ),
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    );

  return (
    <li className="card grid gap-4 p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
      <ScorePill score={booking.score} />
      <div className="space-y-1">
        <p className="font-semibold">
          {booking.userName}{' '}
          <span className="font-normal text-slate-600">· {booking.equipmentName}</span>
        </p>
        <p className="text-sm text-slate-700">{booking.project.title}</p>
        <p className="text-sm text-slate-600">{booking.project.summary}</p>
        <p className="text-xs text-slate-500">
          {formatSlot(booking.slot)} · deadline {booking.project.deadline} · requested{' '}
          {relativeTime(booking.createdAt)}
        </p>
      </div>
      <div className="flex flex-col gap-2 md:w-64">
        <label htmlFor={noteId} className="sr-only">
          Note to {booking.userName} (optional)
        </label>
        <input
          id={noteId}
          className="field py-2"
          placeholder="Optional note to student"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1 px-3 py-2"
            disabled={decide.isPending}
            onClick={() => submit('approve')}
          >
            <Check aria-hidden="true" className="h-4 w-4" /> Approve
          </button>
          <button
            type="button"
            className="btn-danger flex-1 px-3 py-2"
            disabled={decide.isPending}
            onClick={() => submit('reject')}
          >
            <X aria-hidden="true" className="h-4 w-4" /> Decline
          </button>
        </div>
      </div>
    </li>
  );
}
