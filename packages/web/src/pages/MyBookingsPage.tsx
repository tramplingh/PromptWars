import { CHECK_IN_OPENS_BEFORE_MINUTES, formatSlot, type BookingView } from '@lablink/shared';
import { ArrowRightLeft, CalendarDays, ScanLine } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/Badges';
import { timeOfDay } from '../components/shell/activityText';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/api';
import { localToday } from '../lib/format';
import {
  useCancelBooking,
  useCatalogIndex,
  useCheckIn,
  useMyBookings,
  useSession,
} from '../lib/queries';

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
        <h1 className="page-title">My bookings</h1>
        <p className="mt-1 text-sm text-slate-600">
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

/** Left-border accent per status, mirroring the colour of the status badge. */
const STATUS_ACCENT: Record<BookingView['status'], string> = {
  approved: 'border-l-emerald-500',
  pending: 'border-l-amber-500',
  rejected: 'border-l-rose-500',
  cancelled: 'border-l-slate-300',
  'no-show': 'border-l-rose-500',
};

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
  // Mirrors the server rule (the server re-checks): window opens 15 min before start, closes at the end.
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const checkInOpen =
    booking.status === 'approved' &&
    !booking.checkedInAt &&
    booking.slot.date === localToday() &&
    minutes >= booking.slot.startHour * 60 - CHECK_IN_OPENS_BEFORE_MINUTES &&
    minutes < booking.slot.endHour * 60;

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
        {checkInOpen && <CheckInForm booking={booking} />}
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

/** Enter the 6-character code shown on the lab kiosk (or scan its QR) to prove you are at the device. */
function CheckInForm({ booking }: { booking: BookingView }) {
  const checkIn = useCheckIn();
  const notify = useToast();
  const [code, setCode] = useState('');
  const id = useId();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    checkIn.mutate(
      { equipmentId: booking.equipmentId, code },
      {
        onSuccess: () => notify(`Checked in to ${booking.equipmentName}. Enjoy your session!`),
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-teal-200 bg-teal-50/70 p-3"
    >
      <div className="min-w-[10rem] flex-1">
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-teal-900">
          Check in within 15 minutes of the start — enter the code on the lab display
        </label>
        <input
          id={id}
          className="field font-mono uppercase tracking-[0.3em]"
          value={code}
          maxLength={6}
          autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC234"
        />
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={checkIn.isPending || code.trim().length !== 6}
      >
        <ScanLine aria-hidden="true" className="h-4 w-4" /> Check in
      </button>
    </form>
  );
}
