import { formatHour, type UtilisationReport } from '@lablink/shared';
import { Lightbulb } from 'lucide-react';
import { percent } from '../../lib/format';
import { useCatalogIndex, useRecommendations } from '../../lib/queries';
import { AiSourceBadge } from '../Badges';
import { ErrorState, Loading } from '../States';

/** Share at which a utilisation bar turns amber to flag a busy item. */
const BUSY_SHARE = 0.3;

/** Gemini (or rule-based) suggestions for improving utilisation and fairness. */
export function RecommendationsCard({ enabled }: { enabled: boolean }) {
  const recommendations = useRecommendations(enabled);
  return (
    <section aria-labelledby="recs-title" className="card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 id="recs-title" className="section-title flex items-center gap-2">
          <Lightbulb aria-hidden="true" className="h-5 w-5 text-amber-500" /> Optimisation
          recommendations
        </h2>
        {recommendations.data && <AiSourceBadge source={recommendations.data.source} />}
      </div>
      {recommendations.isPending && <Loading label="Generating recommendations" />}
      {recommendations.isError && (
        <ErrorState error={recommendations.error} onRetry={() => void recommendations.refetch()} />
      )}
      {recommendations.data && (
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
  );
}

/** Per-equipment approved hours as a share of capacity, with pending hours alongside. */
export function UtilisationTable({ items }: { items: UtilisationReport['items'] }) {
  const index = useCatalogIndex();
  return (
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
                      className={`h-full rounded-full ${item.utilisation >= BUSY_SHARE ? 'bg-amber-500' : 'bg-brand-500'}`}
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
  );
}

/** Booking-hours per opening hour across campus, to spot peaks. */
export function DemandByHour({ peakHours }: { peakHours: UtilisationReport['peakHours'] }) {
  const maxLoad = Math.max(1, ...peakHours.map((p) => p.load));
  return (
    <section aria-labelledby="peak" className="card p-5">
      <h2 id="peak" className="section-title mb-4">
        Demand by hour
      </h2>
      <ul className="space-y-1.5">
        {peakHours.map((p) => (
          <li key={p.hour} className="flex items-center gap-2 text-xs">
            <span className="w-12 text-right font-medium text-slate-600">{formatHour(p.hour)}</span>
            <span className="h-3 flex-1 overflow-hidden rounded bg-slate-100" aria-hidden="true">
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
  );
}
