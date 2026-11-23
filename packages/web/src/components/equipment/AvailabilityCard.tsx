import type { DayAvailability } from '@lablink/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Selection } from '../../lib/bookingValidation';
import { AvailabilityGrid, AvailabilityLegend } from '../AvailabilityGrid';

interface Props {
  days: DayAvailability[];
  units: number;
  selection: Selection | null;
  onSelect: (date: string, hour: number) => void;
  canGoBack: boolean;
  busy: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** Week of hourly availability with previous/next paging. */
export function AvailabilityCard({
  days,
  units,
  selection,
  onSelect,
  canGoBack,
  busy,
  onPrevious,
  onNext,
}: Props) {
  return (
    <section aria-labelledby="availability-title" className="card min-w-0 lg:col-span-3">
      <div className="card-header">
        <h2 id="availability-title" className="card-title">
          Availability
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary px-2.5 py-1.5"
            disabled={!canGoBack || busy}
            onClick={onPrevious}
            aria-label="Previous week"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn-secondary px-2.5 py-1.5"
            disabled={days.length === 0 || busy}
            onClick={onNext}
            aria-label="Next week"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <AvailabilityLegend />
        <AvailabilityGrid days={days} units={units} selection={selection} onSelect={onSelect} />
      </div>
    </section>
  );
}
