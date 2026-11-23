import { formatSlot, type BookingView } from '@lablink/shared';
import { ArrowRightLeft, ScanLine } from 'lucide-react';
import { useCatalogIndex } from '../../lib/queries';
import { timeOfDay } from '../shell/activityText';

/** Contextual notes on a booking: reallocation, faculty note, check-in, release and backfill. */
export function BookingNotes({ booking }: { booking: BookingView }) {
  const index = useCatalogIndex();
  const from = booking.reallocatedFrom;
  const facultyNote =
    booking.decision?.by !== 'system' && !from ? booking.decision?.note : undefined;
  return (
    <>
      {from && (
        <p className="flex items-start gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <ArrowRightLeft aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Fairly reallocated from{' '}
          {index.equipment.get(from.equipmentId)?.name ?? 'the original equipment'},{' '}
          {formatSlot(from.slot)}, to resolve a scheduling conflict.
        </p>
      )}
      {facultyNote && <p className="text-sm text-slate-600">Faculty note: “{facultyNote}”</p>}
      {booking.checkedInAt && (
        <p className="flex items-center gap-1.5 text-sm text-teal-800">
          <ScanLine aria-hidden="true" className="h-4 w-4" /> Checked in at{' '}
          {timeOfDay(booking.checkedInAt)}
        </p>
      )}
      {booking.status === 'no-show' && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
          No check-in within 15 minutes of the start, so the slot was released to other students.
          These hours still count toward your fair-share usage.
        </p>
      )}
      {booking.backfilledFrom && (
        <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          You received this slot automatically when another student didn’t show up.
        </p>
      )}
    </>
  );
}
