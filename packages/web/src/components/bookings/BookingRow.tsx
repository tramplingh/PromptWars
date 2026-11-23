import { canCheckIn, formatSlot, type BookingView } from '@lablink/shared';
import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../lib/api';
import { localCampusTime } from '../../lib/format';
import { useCancelBooking } from '../../lib/queries';
import { StatusBadge } from '../Badges';
import { useToast } from '../Toast';
import { BookingNotes } from './BookingNotes';
import { CheckInForm } from './CheckInForm';

/** Left-border accent per status, mirroring the colour of the status badge. */
const STATUS_ACCENT: Record<BookingView['status'], string> = {
  approved: 'border-l-emerald-500',
  pending: 'border-l-amber-500',
  rejected: 'border-l-rose-500',
  cancelled: 'border-l-slate-300',
  'no-show': 'border-l-rose-500',
};

/** One of the student's bookings, with its story so far and the actions available now. */
export function BookingRow({
  booking,
  cancellable = false,
}: {
  booking: BookingView;
  cancellable?: boolean;
}) {
  const canCancel = cancellable && (booking.status === 'pending' || booking.status === 'approved');
  // Same rule as the server (which re-checks): opens 15 minutes before the start, closes at the end.
  const checkInOpen = canCheckIn(booking, localCampusTime());

  return (
    <li
      className={`card flex flex-col gap-4 border-l-4 p-5 sm:flex-row sm:items-center ${STATUS_ACCENT[booking.status]}`}
    >
      <div className="flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={booking.status} />
          <Link to={`/equipment/${booking.equipmentId}`} className="font-semibold hover:underline">
            {booking.equipmentName}
          </Link>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-slate-700">
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-slate-500" />{' '}
          {formatSlot(booking.slot)}
        </p>
        <p className="text-sm text-slate-600">
          {booking.project.title} · deadline {booking.project.deadline}
        </p>
        <BookingNotes booking={booking} />
        {checkInOpen && <CheckInForm booking={booking} />}
      </div>
      {canCancel && <CancelButton booking={booking} />}
    </li>
  );
}

function CancelButton({ booking }: { booking: BookingView }) {
  const cancel = useCancelBooking();
  const notify = useToast();
  const onCancel = () =>
    cancel.mutate(booking.id, {
      onSuccess: () => notify('Booking cancelled — the slot is free for others.'),
      onError: (error) => notify(errorMessage(error), 'error'),
    });
  return (
    <button type="button" className="btn-danger" disabled={cancel.isPending} onClick={onCancel}>
      Cancel<span className="sr-only"> booking for {booking.equipmentName}</span>
    </button>
  );
}
