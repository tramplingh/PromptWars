import { NO_SHOW_GRACE_MINUTES, formatHour, type BookingView } from '@lablink/shared';
import { ArrowLeft, CheckCircle2, Clock, ScanLine, TimerOff } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { QrCode } from '../components/QrCode';
import { ErrorState, Loading } from '../components/States';
import { timeOfDay } from '../components/shell/activityText';
import { longDate } from '../lib/format';
import { useCatalogIndex, useKiosk } from '../lib/queries';

/**
 * Lab kiosk display, meant for a tablet mounted next to the device. Students
 * scan the QR (or type the code) to prove they are physically present.
 */
export function KioskPage() {
  const { id = '' } = useParams();
  const kiosk = useKiosk(id);
  const index = useCatalogIndex();
  const equipment = index.equipment.get(id);

  if (kiosk.isPending) return <Loading label="Loading kiosk" />;
  if (kiosk.isError) return <ErrorState error={kiosk.error} onRetry={() => void kiosk.refetch()} />;

  const { code, date, sessions } = kiosk.data;
  const checkInUrl = `${window.location.origin}/check-in?e=${encodeURIComponent(id)}&c=${code}`;

  return (
    <div className="space-y-6">
      <Link
        to={`/equipment/${id}`}
        className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to equipment
      </Link>

      <header>
        <p className="eyebrow">Lab kiosk display · {longDate(date)}</p>
        <h1 className="page-title mt-1">{equipment?.name ?? id}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Show this screen beside the device. Sessions without a check-in {NO_SHOW_GRACE_MINUTES}{' '}
          minutes after they start are released to the next student in the queue.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <section
          aria-labelledby="checkin-title"
          className="card flex flex-col items-center gap-4 p-6 text-center"
        >
          <h2 id="checkin-title" className="flex items-center gap-2 text-base font-semibold">
            <ScanLine aria-hidden="true" className="h-5 w-5 text-brand-700" /> Scan to check in
          </h2>
          <QrCode value={checkInUrl} />
          <div>
            <p className="text-xs text-slate-500">or enter today’s code in My bookings</p>
            <p
              className="mt-1 font-mono text-4xl font-bold tracking-[0.35em] text-ink"
              aria-label={`Check-in code ${code.split('').join(' ')}`}
            >
              {code}
            </p>
          </div>
          <p className="text-2xs text-slate-500">
            The code changes every day and only works for this device.
          </p>
        </section>

        <section aria-labelledby="today-title" className="card">
          <div className="card-header">
            <h2 id="today-title" className="card-title">
              Today’s sessions
            </h2>
            <span className="text-xs text-slate-500">Updates every 30 seconds</span>
          </div>
          {sessions.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">No confirmed sessions today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: BookingView }) {
  const state =
    session.status === 'no-show'
      ? { icon: TimerOff, label: 'No-show · released', className: 'text-rose-700' }
      : session.checkedInAt
        ? {
            icon: CheckCircle2,
            label: `Checked in ${timeOfDay(session.checkedInAt)}`,
            className: 'text-teal-700',
          }
        : { icon: Clock, label: 'Awaiting check-in', className: 'text-amber-700' };
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="metric w-28 text-sm">
        {formatHour(session.slot.startHour)}–{formatHour(session.slot.endHour)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{session.userName}</span>
        <span className="block truncate text-xs text-slate-500">{session.project.title}</span>
      </span>
      <span className={`flex items-center gap-1.5 text-sm font-medium ${state.className}`}>
        <state.icon aria-hidden="true" className="h-4 w-4" />
        {state.label}
      </span>
    </li>
  );
}
