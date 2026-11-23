import type { UtilisationReport } from '@lablink/shared';
import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import { RankedBars } from '../ui/ProgressBar';

const TOP_N = 5;

/** Highest and lowest utilisation side by side (maintenance items, with no capacity, are excluded). */
export function PerformanceCard({
  report,
  description,
  actions,
}: {
  report: UtilisationReport | undefined;
  description?: string;
  actions?: ReactNode;
}) {
  const operational = (report?.items ?? []).filter((i) => i.capacityHours > 0);
  const toBars = (items: typeof operational) =>
    items.map((i) => ({ id: i.equipmentId, label: i.name, value: i.utilisation }));
  // Items arrive sorted by utilisation, highest first.
  const highest = operational.slice(0, TOP_N);
  const lowest = [...operational].sort((a, b) => a.utilisation - b.utilisation).slice(0, TOP_N);

  return (
    <Card
      title="Equipment performance"
      description={description}
      actions={actions}
      bodyClassName="grid gap-8 p-5 md:grid-cols-2 [&>*]:min-w-0"
    >
      <div>
        <h3 className="mb-4 text-sm font-semibold text-ink">Highest utilisation</h3>
        <RankedBars tone="teal" items={toBars(highest)} />
      </div>
      <div className="md:border-l md:border-slate-200 md:pl-8">
        <h3 className="mb-4 text-sm font-semibold text-ink">Lowest utilisation</h3>
        <RankedBars tone="orange" items={toBars(lowest)} />
      </div>
    </Card>
  );
}
