import { Activity, Gauge, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  DemandByHour,
  RecommendationsCard,
  UtilisationTable,
} from '../components/insights/InsightSections';
import { PerformanceCard } from '../components/insights/PerformanceCard';
import { ErrorState, Loading } from '../components/States';
import { longDate, percent } from '../lib/format';
import { useSession, useUtilisation } from '../lib/queries';

/** Campus-wide utilisation report with AI optimisation recommendations. */
export function InsightsPage() {
  const { data: session } = useSession();
  const allowed = session?.persona?.role === 'faculty' || session?.persona?.role === 'admin';
  const report = useUtilisation(allowed);

  if (report.isPending) return <Loading label="Crunching utilisation" />;
  if (report.isError)
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;

  const { items, peakHours, overall, from, to } = report.data;
  const pendingHours = items.reduce((sum, i) => sum + i.pendingHours, 0);
  const idle = items.filter((i) => i.capacityHours > 0 && i.approvedHours === 0).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="page-title">Resource utilisation</h1>
        <p className="mt-1 text-sm text-slate-600">
          {longDate(from)} – {longDate(to)} · 10 working days across all departments
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<Gauge aria-hidden="true" className="h-5 w-5" />}
          label="Campus utilisation"
          value={percent(overall)}
        />
        <Stat
          icon={<Timer aria-hidden="true" className="h-5 w-5" />}
          label="Hours awaiting approval"
          value={`${pendingHours}h`}
        />
        <Stat
          icon={<Activity aria-hidden="true" className="h-5 w-5" />}
          label="Idle equipment"
          value={`${idle} of ${items.length}`}
        />
      </ul>

      <PerformanceCard
        report={report.data}
        description="Approved hours as a share of bookable capacity"
      />
      <RecommendationsCard enabled={allowed} />

      <div className="grid gap-6 lg:grid-cols-3">
        <UtilisationTable items={items} />
        <DemandByHour peakHours={peakHours} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className="card flex items-center gap-4 p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </span>
      <div>
        <p className="text-sm text-slate-600">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </li>
  );
}
