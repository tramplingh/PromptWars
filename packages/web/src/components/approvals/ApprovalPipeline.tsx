import type { ApprovalQueue } from '@lablink/shared';
import { Clock3, GitCompareArrows, Inbox } from 'lucide-react';
import { localDateOf, localToday, splitByRecency } from '../../lib/format';
import { isUrgent } from '../../lib/policy';
import { StatTile } from '../ui/StatTile';

/** Pipeline KPIs for the approval queue, split into Today / This week / Older. */
export function ApprovalPipeline({ queue }: { queue: ApprovalQueue }) {
  const today = localToday();
  const standalone = queue.pending.filter((p) => !p.conflictId);
  return (
    <ul className="grid gap-4 sm:grid-cols-3" aria-label="Approval pipeline">
      <StatTile
        label="Awaiting approval"
        icon={<Clock3 aria-hidden="true" className="h-4 w-4" />}
        urgent={queue.pending.filter((p) => isUrgent(p.project.deadline, today)).length}
        splits={splitByRecency(
          queue.pending.map((p) => localDateOf(p.createdAt)),
          'past',
        )}
      />
      <StatTile
        label="In conflict"
        icon={<GitCompareArrows aria-hidden="true" className="h-4 w-4" />}
        hint="Requests competing for the same slot, grouped by slot date"
        splits={splitByRecency(
          queue.conflicts.map((c) => c.conflict.date),
          'future',
        )}
      />
      <StatTile
        label="Standalone requests"
        icon={<Inbox aria-hidden="true" className="h-4 w-4" />}
        splits={splitByRecency(
          standalone.map((p) => p.slot.date),
          'future',
        )}
      />
    </ul>
  );
}
