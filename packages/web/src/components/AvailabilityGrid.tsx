import { formatHour, type DayAvailability, type HourCell } from '@lablink/shared';
import { memo } from 'react';
import { localToday, weekdayLabel } from '../lib/format';
import { now } from '../lib/clock';

import type { Selection } from '../lib/bookingValidation';

export type { Selection };

interface Props {
  days: DayAvailability[];
  units: number;
  selection: Selection | null;
  onSelect: (date: string, hour: number) => void;
}

type CellState = 'free' | 'partial' | 'requested' | 'booked' | 'past';

function cellState(cell: HourCell, units: number, isPast: boolean): CellState {
  if (isPast) return 'past';
  if (cell.approved >= units) return 'booked';
  if (cell.free === 0) return 'requested';
  return cell.free < units ? 'partial' : 'free';
}

const STATE_STYLE: Record<CellState, string> = {
  free: 'bg-white text-emerald-800 hover:bg-emerald-50 hover:border-emerald-400 border-emerald-200',
  partial: 'bg-teal-50 text-teal-800 hover:bg-teal-100 border-teal-200',
  requested: 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200',
  booked: 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed',
  past: 'bg-slate-50 text-slate-400 border-transparent cursor-not-allowed',
};

function describe(
  state: CellState,
  cell: HourCell,
  units: number,
): { short: string; long: string } {
  switch (state) {
    case 'free':
      return { short: 'Free', long: 'Free, available to book' };
    case 'partial':
      return {
        short: `${cell.free}/${units} free`,
        long: `${cell.free}/${units} free: ${cell.free} of ${units} units available`,
      };
    case 'requested':
      return {
        short: 'Requested',
        long: 'Requested by others — you can join the fair-allocation queue',
      };
    case 'booked':
      return { short: 'Booked', long: 'Booked, no units left' };
    case 'past':
      return { short: '—', long: 'in the past' };
  }
}

/**
 * Weekly hour-by-hour availability. Implemented as a real table of buttons so
 * it is fully keyboard- and screen-reader-navigable, with text (not only
 * colour) conveying each state.
 */
export const AvailabilityGrid = memo(function AvailabilityGrid({
  days,
  units,
  selection,
  onSelect,
}: Props) {
  const hours = days[0]?.hours.map((h) => h.hour) ?? [];
  const today = localToday();
  const currentHour = now().getHours();

  const isSelected = (date: string, hour: number) =>
    selection?.date === date &&
    hour >= selection.startHour &&
    hour < selection.startHour + selection.hours;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">
          Hourly availability. Choose a start time to begin a booking.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-16 text-left text-xs font-medium text-slate-500">
              <span className="sr-only">Time</span>
            </th>
            {days.map((d) => (
              <th
                key={d.date}
                scope="col"
                className="pb-1 text-center text-xs font-semibold text-slate-700"
              >
                {weekdayLabel(d.date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour, rowIndex) => (
            <tr key={hour}>
              <th scope="row" className="pr-2 text-right text-xs font-medium text-slate-500">
                {formatHour(hour)}
              </th>
              {days.map((day) => {
                const cell = day.hours[rowIndex];
                if (!cell) return <td key={day.date} />;
                const isPast = day.date < today || (day.date === today && hour < currentHour);
                const state = cellState(cell, units, isPast);
                const disabled = state === 'booked' || state === 'past';
                const selected = isSelected(day.date, hour);
                const text = describe(state, cell, units);
                return (
                  <td key={day.date} className="p-0">
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={`${weekdayLabel(day.date)} ${formatHour(hour)}: ${selected ? 'Selected, ' : ''}${text.long}`}
                      onClick={() => onSelect(day.date, hour)}
                      className={`h-9 w-full rounded-md border text-xs font-medium transition ${
                        selected
                          ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700'
                          : STATE_STYLE[state]
                      }`}
                    >
                      {selected ? 'Selected' : text.short}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export function AvailabilityLegend() {
  const items: [string, string][] = [
    ['bg-white border-emerald-300', 'Free'],
    ['bg-teal-100 border-teal-300', 'Some units free'],
    ['bg-amber-100 border-amber-300', 'Requested — fair queue'],
    ['bg-slate-200 border-slate-300', 'Booked'],
    ['bg-brand-600 border-brand-600', 'Your selection'],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600" aria-label="Legend">
      {items.map(([swatch, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-3 w-3 rounded border ${swatch}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
