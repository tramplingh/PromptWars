import { Link } from 'react-router-dom';
import { BookingRow } from '../components/bookings/BookingRow';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { localToday } from '../lib/format';
import { useMyBookings, useSession } from '../lib/queries';

/** The student's bookings: upcoming (soonest first) and history. */
export function MyBookingsPage() {
  const { data: session } = useSession();
  const bookings = useMyBookings(Boolean(session?.persona));
  const today = localToday();

  if (bookings.isPending) return <Loading label="Loading your bookings" />;
  if (bookings.isError)
    return <ErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />;

  // The API returns newest first; upcoming reads best soonest first.
  const upcoming = bookings.data
    .filter((b) => b.slot.date >= today && b.status !== 'cancelled')
    .reverse();
  const past = bookings.data.filter((b) => b.slot.date < today || b.status === 'cancelled');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="page-title">My bookings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track requests, approvals, check-ins and any fair-share reallocations.
        </p>
      </header>

      <section aria-labelledby="upcoming-title" className="space-y-3">
        <h2 id="upcoming-title" className="section-title">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming bookings">
            <Link to="/equipment" className="font-semibold text-brand-700 hover:underline">
              Browse equipment
            </Link>{' '}
            or plan a whole project to get started.
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
