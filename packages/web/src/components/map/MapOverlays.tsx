import type { LiveState } from '@lablink/shared';
import { Minus, Plus } from 'lucide-react';
import type { LiveSummary } from '../../lib/catalogFilters';
import { LIVE_STYLE } from '../ui/LiveStatusPill';

const LEGEND_STATES: LiveState[] = ['available', 'requested', 'in-use', 'closed', 'maintenance'];

/** Live counts floating over the top-left of the scene. */
export function MapStats({ summary }: { summary: LiveSummary }) {
  const stats = [
    { label: 'Available now', value: summary.available, color: LIVE_STYLE.available.fill },
    { label: 'In use / requested', value: summary.busy, color: LIVE_STYLE['in-use'].fill },
    { label: 'Down', value: summary.down, color: LIVE_STYLE.maintenance.fill },
  ];
  return (
    <dl className="glass pointer-events-none absolute left-3 top-3 hidden gap-5 px-4 py-2.5 sm:flex">
      {stats.map((s) => (
        <div key={s.label}>
          <dt className="flex items-center gap-1.5 text-2xs text-slate-600">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </dt>
          <dd className="metric text-xl">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ZoomControls({
  level,
  max,
  onChange,
}: {
  level: number;
  max: number;
  onChange: (level: number) => void;
}) {
  return (
    <div className="glass absolute right-3 top-3 flex flex-col p-1">
      <button
        type="button"
        className="icon-btn h-8 w-8"
        aria-label="Zoom in"
        disabled={level === max}
        onClick={() => onChange(level + 1)}
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="icon-btn h-8 w-8"
        aria-label="Zoom out"
        disabled={level === 0}
        onClick={() => onChange(level - 1)}
      >
        <Minus aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MapLegend() {
  return (
    <ul
      className="glass absolute bottom-3 left-3 hidden flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs text-slate-700 md:flex"
      aria-label="Map legend"
    >
      {LEGEND_STATES.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: LIVE_STYLE[s].fill }}
          />
          {LIVE_STYLE[s].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-0.5 w-4 rounded bg-brand-700" />
        Your route
      </li>
    </ul>
  );
}
