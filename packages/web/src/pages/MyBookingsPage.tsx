import { formatSlot, type BookingView } from '@lablink/shared';
import { ArrowRightLeft, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/Badges';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/api';
import { localToday } from '../lib/format';
import { useCancelBooking, useCatalogIndex, useMyBookings, useSession } from '../lib/queries';

export function MyBookingsPage() {
  const { data: session } = useSession();
  const bookings = useMyBookings(Boolean(session?.persona));
  const today = localToday();

  if (bookings.isPending) return <Loading label="Loading your bookings" />;
  if (bookings.isError)
    return <ErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />;

  const upcoming = bookings.data
    .filter((b) => b.slot.date >= today && b.status !== 'cancelled')
    .reverse();
  const past = bookings.data.filter((b) => b.slot.date < today || b.status === 'cancelled');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">My bookings</h1>
        <p className="mt-1 text-slate-600">
          Track requests, approvals and any fair-share reallocations.
        </p>
      </header>

      <section aria-labelledby="upcoming-title" className="space-y-3">
        <h2 id="upcoming-title" className="section-title">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming bookings">
            <Link to="/" className="font-semibold text-brand-700 hover:underline">
              Discover equipment
            </Link>{' '}
            to get started.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <BookingRow key={b.id} booking={b} cancellable />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-title" className="space-y-3">
          <h2 id="past-title" className="section-title">
            History
          </h2>
          <ul className="space-y-3">
            {past.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  cancellable = false,
}: {
  booking: BookingView;
  cancellable?: boolean;
}) {
  const cancel = useCancelBooking();
  const notify = useToast();
  const index = useCatalogIndex();
  const canCancel = cancellable && (booking.status === 'pending' || booking.status === 'approved');
  const from = booking.reallocatedFrom;

  return (
    <li className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
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
        {from && (
          <p className="flex items-start gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
            <ArrowRightLeft aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            Fairly reallocated from{' '}
            {index.equipment.get(from.equipmentId)?.name ?? 'the original equipment'},{' '}
            {formatSlot(from.slot)}, to resolve a scheduling conflict.
          </p>
        )}
        {booking.decision?.note && booking.decision.by !== 'system' && !from && (
          <p className="text-sm text-slate-600">Faculty note: “{booking.decision.note}”</p>
        )}
      </div>
      {canCancel && (
        <button
          type="button"
          className="btn-danger"
          disabled={cancel.isPending}
          onClick={() =>
            cancel.mutate(booking.id, {
              onSuccess: () => notify('Booking cancelled — the slot is free for others.'),
              onError: (error) => notify(errorMessage(error), 'error'),
            })
          }
        >
          Cancel<span className="sr-only"> booking for {booking.equipmentName}</span>
        </button>
      )}
    </li>
  );
}
