const TONES = {
  brand: 'bg-brand-600',
  teal: 'bg-teal-600',
  orange: 'bg-orange-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
} as const;

interface ProgressBarProps {
  /** 0–1. */
  value: number;
  label: string;
  tone?: keyof typeof TONES;
  size?: 'sm' | 'md';
}

/** Accessible horizontal meter (role="meter" with a percentage value). */
export function ProgressBar({ value, label, tone = 'brand', size = 'sm' }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      className={`w-full overflow-hidden rounded-full bg-slate-100 ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}
    >
      <div className={`h-full rounded-full ${TONES[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface RankedBarsProps {
  items: { id: string; label: string; value: number; sub?: string }[];
  tone: keyof typeof TONES;
  emptyText?: string;
}

/** "Highest / lowest utilisation" style list of labelled bars. */
export function RankedBars({ items, tone, emptyText = 'No data yet' }: RankedBarsProps) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const pct = Math.round(item.value * 100);
        return (
          <li key={item.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-700">
                {item.label}
                {item.sub && <span className="ml-1.5 text-xs text-slate-500">{item.sub}</span>}
              </span>
              <span className="metric text-sm">{pct}%</span>
            </div>
            <ProgressBar value={item.value} label={`${item.label} utilisation`} tone={tone} />
          </li>
        );
      })}
    </ul>
  );
}
