import { formatHour, type LiveState, type LiveStatus } from '@lablink/shared';

export const LIVE_STYLE: Record<
  LiveState,
  { label: string; dot: string; pill: string; fill: string }
> = {
  available: {
    label: 'Available now',
    dot: 'bg-emerald-500',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    fill: '#10b981',
  },
  requested: {
    label: 'Requested',
    dot: 'bg-amber-500',
    pill: 'border-amber-200 bg-amber-50 text-amber-800',
    fill: '#f59e0b',
  },
  'in-use': {
    label: 'In use',
    dot: 'bg-brand-600',
    pill: 'border-brand-200 bg-brand-50 text-brand-800',
    fill: '#2563eb',
  },
  closed: {
    label: 'Lab closed',
    dot: 'bg-slate-400',
    pill: 'border-slate-200 bg-slate-100 text-slate-700',
    fill: '#94a3b8',
  },
  maintenance: {
    label: 'Down',
    dot: 'bg-rose-600',
    pill: 'border-rose-200 bg-rose-50 text-rose-800',
    fill: '#e11d48',
  },
};

/** Human-readable live status, e.g. "In use · free from 1PM" or "2 units free". */
export function liveStatusText(status: LiveStatus): string {
  if (status.state === 'in-use') {
    return status.freeFromHour !== undefined
      ? `In use · free from ${formatHour(status.freeFromHour)}`
      : 'In use for the rest of today';
  }
  if (status.state === 'available' && status.freeUnits > 1)
    return `${status.freeUnits} units free now`;
  if (status.state === 'maintenance') return 'Down for maintenance';
  return LIVE_STYLE[status.state].label;
}

export function LiveStatusPill({ status }: { status?: LiveStatus }) {
  if (!status) return null;
  const style = LIVE_STYLE[status.state];
  return (
    <span className={`chip ${style.pill}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {liveStatusText(status)}
    </span>
  );
}
