import { formatHour } from '@lablink/shared';
import { Activity, Gauge, Lightbulb, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { AiSourceBadge } from '../components/Badges';
import { ErrorState, Loading } from '../components/States';
import { Card } from '../components/ui/Card';
import { RankedBars } from '../components/ui/ProgressBar';
import { longDate, percent } from '../lib/format';
import { useCatalogIndex, useRecommendations, useSession, useUtilisation } from '../lib/queries';

export function InsightsPage() {
  const { data: session } = useSession();
  const allowed = session?.persona?.role === 'faculty' || session?.persona?.role === 'admin';
  const report = useUtilisation(allowed);
  const recommendations = useRecommendations(allowed);
  const index = useCatalogIndex();

  if (report.isPending) return <Loading label="Crunching utilisation" />;
  if (report.isError)
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;

  const { items, peakHours, overall, from, to } = report.data;
  const pendingHours = items.reduce((s, i) => s + i.pendingHours, 0);
  const idle = items.filter((i) => i.capacityHours > 0 && i.approvedHours === 0).length;
  const maxLoad = Math.max(1, ...peakHours.map((p) => p.load));
  // Items arrive sorted by utilisation (desc); maintenance items have no capacity.
  const operational = items.filter((i) => i.capacityHours > 0);

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

      <Card
        title="Equipment performance"
        description="Approved hours as a share of bookable capacity"
        bodyClassName="grid gap-8 p-5 md:grid-cols-2 [&>*]:min-w-0"
      >
        <div>
          <h3 className="mb-4 text-sm font-semibold text-ink">Highest utilisation</h3>
          <RankedBars
            tone="teal"
            items={operational
              .slice(0, 5)
              .map((i) => ({ id: i.equipmentId, label: i.name, value: i.utilisation }))}
          />
        </div>
        <div className="md:border-l md:border-slate-200 md:pl-8">
          <h3 className="mb-4 text-sm font-semibold text-ink">Lowest utilisation</h3>
          <RankedBars
            tone="orange"
            items={[...operational]
              .reverse()
              .slice(0, 5)
              .map((i) => ({ id: i.equipmentId, label: i.name, value: i.utilisation }))}
          />
        </div>
      </Card>

      <section aria-labelledby="recs-title" className="card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="recs-title" className="section-title flex items-center gap-2">
            <Lightbulb aria-hidden="true" className="h-5 w-5 text-amber-500" /> Optimisation
            recommendations
          </h2>
          {recommendations.data && <AiSourceBadge source={recommendations.data.source} />}
        </div>
        {recommendations.isPending ? (
          <Loading label="Generating recommendations" />
        ) : recommendations.isError ? (
          <ErrorState
            error={recommendations.error}
            onRetry={() => void recommendations.refetch()}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {recommendations.data.insights.map((insight) => (
              <li
                key={insight.title}
                className="rounded-lg border border-slate-200 border-l-4 border-l-amber-400 p-4"
              >
                <p className="font-semibold">{insight.title}</p>
                <p className="mt-1 text-sm text-slate-600">{insight.detail}</p>
                <p className="mt-2 text-sm font-medium text-brand-700">→ {insight.action}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="per-item" className="card p-5 lg:col-span-2">
          <h2 id="per-item" className="section-title mb-4">
            Utilisation by equipment
          </h2>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Approved hours as a share of bookable capacity per equipment
            </caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="pb-2 font-medium">
                  Equipment
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Utilisation
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Booked / pending
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.equipmentId}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium text-slate-800">
                    {item.name}
                    <span className="block text-xs font-normal text-slate-500">
                      {index.departments.get(item.departmentId)?.code}
                      {item.capacityHours === 0 && ' · maintenance'}
                    </span>
                  </th>
                  <td className="w-2/5 py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                        aria-hidden="true"
                      >
                        <div
                          className={`h-full rounded-full ${item.utilisation >= 0.3 ? 'bg-amber-500' : 'bg-brand-500'}`}
                          style={{ width: `${Math.min(100, item.utilisation * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right tabular-nums text-slate-700">
                        {percent(item.utilisation)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-700">
                    {item.approvedHours}h / {item.pendingHours}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="peak" className="card p-5">
          <h2 id="peak" className="section-title mb-4">
            Demand by hour
          </h2>
          <ul className="space-y-1.5">
            {peakHours.map((p) => (
              <li key={p.hour} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-right font-medium text-slate-600">
                  {formatHour(p.hour)}
                </span>
                <span
                  className="h-3 flex-1 overflow-hidden rounded bg-slate-100"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded bg-violet-500"
                    style={{ width: `${(p.load / maxLoad) * 100}%` }}
                  />
                </span>
                <span className="w-10 tabular-nums text-slate-700">
                  {p.load}h<span className="sr-only"> of bookings</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
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
