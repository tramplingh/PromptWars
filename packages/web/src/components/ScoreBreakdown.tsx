import { SCORE_WEIGHTS, type PriorityScore, type ScoreFactor } from '@lablink/shared';

const LABELS: Record<ScoreFactor, string> = {
  urgency: 'Deadline urgency',
  fairness: 'Fair share',
  fit: 'Capability fit',
  waiting: 'Waiting time',
};

/** Transparent view of how a priority score was computed. */
export function ScoreBreakdown({ score }: { score: PriorityScore }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {(Object.keys(SCORE_WEIGHTS) as ScoreFactor[]).map((factor) => {
        const value = score.breakdown[factor];
        return (
          <div key={factor}>
            <dt className="flex justify-between text-xs text-slate-600">
              <span>
                {LABELS[factor]}{' '}
                <span className="text-slate-500">· {Math.round(SCORE_WEIGHTS[factor] * 100)}%</span>
              </span>
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <div
                role="meter"
                aria-label={LABELS[factor]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(value * 100)}
                className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.round(value * 100)}%` }}
                />
              </div>
              <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-700">
                {Math.round(value * 100)}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Green for strong priority, brand for middling, grey for low. */
export function scoreTone(total: number): string {
  if (total >= 70) return 'bg-emerald-700';
  return total >= 50 ? 'bg-brand-600' : 'bg-slate-500';
}

export function ScorePill({ score }: { score: PriorityScore }) {
  const tone = scoreTone(score.total);
  return (
    <span
      className={`inline-flex min-w-[3rem] flex-col items-center rounded-xl px-2 py-1 text-white ${tone}`}
    >
      <span className="text-lg font-bold leading-none tabular-nums">{score.total}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide">priority</span>
    </span>
  );
}
