import { GitCompareArrows } from 'lucide-react';
import { ApprovalPipeline } from '../components/approvals/ApprovalPipeline';
import { ConflictCard } from '../components/approvals/ConflictCard';
import { PendingRow } from '../components/approvals/PendingRow';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { useApprovals, useSession } from '../lib/queries';

/** Faculty/admin review queue: fair-allocation conflicts first, then standalone requests. */
export function ApprovalsPage() {
  const { data: session } = useSession();
  const role = session?.persona?.role;
  const queue = useApprovals(role === 'faculty' || role === 'admin');

  if (queue.isPending) return <Loading label="Loading approval queue" />;
  if (queue.isError) return <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />;

  const { conflicts, pending } = queue.data;
  const standalone = pending.filter((p) => !p.conflictId);
  const scope = role === 'admin' ? 'All departments' : 'Requests for equipment in your department';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="page-title">Approvals</h1>
        <p className="mt-1 text-sm text-slate-600">
          {scope} · ranked by a transparent fair-share score.
        </p>
      </header>

      <ApprovalPipeline queue={queue.data} />

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
