import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface StatSplit {
  label: string;
  value: number | string;
}

interface StatTileProps {
  label: string;
  /** Headline value; omitted when the tile is fully described by its splits. */
  value?: number | string;
  hint?: string;
  icon?: ReactNode;
  /** Today / This week / Older style breakdown (pipeline tiles). */
  splits?: StatSplit[];
  /** Red "N Urgent" style flag next to the label. */
  urgent?: number;
  /** Makes the whole tile a link. */
  to?: string;
}

/** KPI tile in the style of an operations pipeline board. */
export function StatTile({ label, value, hint, icon, splits, urgent, to }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            {icon}
          </span>
        )}
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {hint && (
          <span title={hint} className="text-slate-400">
            <Info aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">{hint}</span>
          </span>
        )}
        {urgent !== undefined && urgent > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-rose-700">
            <span className="grid h-4 min-w-4 place-items-center rounded bg-rose-600 px-1 text-2xs font-bold text-white">
              {urgent}
            </span>
            Urgent
          </span>
        )}
      </div>
      {value !== undefined && <p className="metric mt-3 text-3xl">{value}</p>}
      {splits && (
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {splits.map((s) => (
            <div key={s.label}>
              <dd className="metric text-lg">{s.value}</dd>
              <dt className="text-2xs text-slate-500">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  const className = 'block h-full p-4 transition-colors';
  return (
    <li className="card overflow-hidden">
      {to ? (
        <Link to={to} className={`${className} hover:bg-slate-50`}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}
