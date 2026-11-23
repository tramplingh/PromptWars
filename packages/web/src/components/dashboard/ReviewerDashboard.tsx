import { formatSlot, type AllocationPlan, type ScoredBooking } from '@lablink/shared';
import { Clock3, Gauge, GitCompareArrows, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { localDateOf, localToday, longDate, splitByRecency } from '../../lib/format';
import { isUrgent } from '../../lib/policy';
import { useApprovals, useLiveStatus, useUtilisation } from '../../lib/queries';
import { PerformanceCard } from '../insights/PerformanceCard';
import { UpdatesFeed } from '../UpdatesFeed';
import { Card } from '../ui/Card';
import { StatTile } from '../ui/StatTile';

const linkClass = 'text-sm font-medium text-brand-700 hover:underline';

/** Faculty/admin overview: approval pipeline, live equipment state, utilisation and conflicts. */
export function ReviewerDashboard() {
  const { data: queue } = useApprovals(true);
  const { data: report } = useUtilisation(true);
  const { data: live = [] } = useLiveStatus();
  const today = localToday();
  const pending = queue?.pending ?? [];
  const conflicts = queue?.conflicts ?? [];
  const count = (state: string) => live.filter((s) => s.state === state).length;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Awaiting approval"
          icon={<Clock3 aria-hidden="true" className="h-4 w-4" />}
          hint="Pending requests for equipment you manage, by when they were submitted"
          urgent={pending.filter((p) => isUrgent(p.project.deadline, today)).length}
          splits={splitByRecency(
            pending.map((p) => localDateOf(p.createdAt)),
            'past',
          )}
          to="/approvals"
        />
        <StatTile
          label="Scheduling conflicts"
          icon={<GitCompareArrows aria-hidden="true" className="h-4 w-4" />}
          hint="Overlapping requests with a recommended fair allocation, by slot date"
          splits={splitByRecency(
            conflicts.map((c) => c.conflict.date),
            'future',
          )}
          to="/approvals"
        />
        <StatTile
          label="Live right now"
          icon={<Gauge aria-hidden="true" className="h-4 w-4" />}
          splits={[
            { label: 'Available', value: count('available') },
            { label: 'In use', value: count('in-use') },
            { label: 'Requested', value: count('requested') },
          ]}
          to="/map"
        />
        <StatTile
          label="Down equipment"
          icon={<Wrench aria-hidden="true" className="h-4 w-4" />}
          value={count('maintenance')}
          to="/insights"
        />
      </ul>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <PerformanceCard
            report={report}
            description={report ? `${longDate(report.from)} – ${longDate(report.to)}` : undefined}
            actions={
              <Link to="/insights" className={linkClass}>
                Full report
              </Link>
            }
          />
          <ConflictsCard conflicts={conflicts} pending={pending} />
        </div>
        <UpdatesFeed />
      </div>
    </>
  );
}

function ConflictsCard({
  conflicts,
  pending,
}: {
  conflicts: AllocationPlan[];
  pending: ScoredBooking[];
}) {
  return (
    <Card
      title="Conflicts needing a decision"
      actions={
        <Link to="/approvals" className={linkClass}>
          Resolve
        </Link>
      }
      bodyClassName="p-0"
    >
      {conflicts.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          No conflicts — every request fits its equipment's capacity.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {conflicts.map(({ conflict, decisions, summary }) => (
            <li
              key={conflict.id}
              className="flex flex-wrap items-center gap-3 border-l-4 border-l-amber-500 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {pending.find((p) => p.conflictId === conflict.id)?.equipmentName}
                </p>
                <p className="text-xs text-slate-500">
                  {formatSlot({
                    date: conflict.date,
                    startHour: conflict.startHour,
                    endHour: conflict.endHour,
                  })}{' '}
                  · {decisions.length} requests
                </p>
              </div>
              <p className="text-xs text-slate-600">{summary}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
