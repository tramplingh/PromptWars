import { addDays, formatHour, type Alternative, type ProjectInput } from '@lablink/shared';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, MapPin, Users, Wrench } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AvailabilityGrid,
  AvailabilityLegend,
  type Selection,
} from '../components/AvailabilityGrid';
import { ApprovalBadge } from '../components/Badges';
import { BookingForm } from '../components/BookingForm';
import { CategoryIcon } from '../components/CategoryIcon';
import { ErrorState, Loading } from '../components/States';
import { useEquipmentDetail, useSession } from '../lib/queries';

interface PrefillState {
  selection?: Selection;
  project?: ProjectInput;
  from?: string;
}

/** Remounts per equipment id so local selection state never leaks between items. */
export function EquipmentRoute() {
  const { id = '' } = useParams();
  return <EquipmentPage key={id} id={id} />;
}

function EquipmentPage({ id }: { id: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state ?? {}) as PrefillState;

  const [from, setFrom] = useState<string | undefined>(prefill.from);
  const [history, setHistory] = useState<string[]>([]);
  const [selection, setSelection] = useState<Selection | null>(prefill.selection ?? null);
  const detail = useEquipmentDetail(id, from);
  const { data: session } = useSession();
  const isStudent = session?.persona?.role === 'student';

  const onSelect = useCallback(
    (date: string, startHour: number) =>
      setSelection((current) => ({ date, startHour, hours: current?.hours ?? 1 })),
    [],
  );

  if (detail.isPending) return <Loading label="Loading equipment" />;
  if (detail.isError)
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;

  const { equipment, lab, department, availability } = detail.data;
  const lastDay = availability[availability.length - 1]?.date;

  const useAlternative = (alt: Alternative, project: ProjectInput) => {
    const next: PrefillState = {
      selection: {
        date: alt.slot.date,
        startHour: alt.slot.startHour,
        hours: alt.slot.endHour - alt.slot.startHour,
      },
      project,
    };
    if (alt.equipmentId === equipment.id) {
      setSelection(next.selection ?? null);
    } else {
      navigate(`/equipment/${alt.equipmentId}`, { state: next });
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to catalogue
      </Link>

      <header className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
        <CategoryIcon category={equipment.category} size="lg" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {department.name} · {equipment.category}
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{equipment.name}</h1>
          </div>
          <p className="max-w-3xl text-slate-700">{equipment.description}</p>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
            <div className="flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <dt className="sr-only">Location</dt>
              <dd>
                {lab.name}, {lab.location}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <dt className="sr-only">Opening hours</dt>
              <dd>
                {formatHour(lab.openHour)}–{formatHour(lab.closeHour)}, Mon–Fri
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Users aria-hidden="true" className="h-4 w-4 text-slate-500" />
              <dt className="sr-only">Units</dt>
              <dd>
                {equipment.units} unit{equipment.units > 1 ? 's' : ''} · max{' '}
                {equipment.maxHoursPerBooking}h per booking
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-1.5">
            <ApprovalBadge requiresApproval={equipment.requiresApproval} />
            {equipment.capabilities.map((c) => (
              <span key={c} className="chip border-slate-200 bg-slate-50 text-slate-700">
                {c}
              </span>
            ))}
          </div>
        </div>
      </header>

      {equipment.status === 'maintenance' ? (
        <div
          role="status"
          className="card flex items-center gap-3 border-rose-200 bg-rose-50 p-5 text-rose-900"
        >
          <Wrench aria-hidden="true" className="h-5 w-5" />
          This equipment is under maintenance and cannot be booked right now. Use AI search to find
          an alternative.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <section
            aria-labelledby="availability-title"
            className="card space-y-4 p-5 lg:col-span-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="availability-title" className="section-title">
                Availability
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary px-2.5 py-1.5"
                  disabled={history.length === 0 || detail.isFetching}
                  onClick={() => {
                    setFrom(history[history.length - 1] || undefined);
                    setHistory((h) => h.slice(0, -1));
                  }}
                  aria-label="Previous week"
                >
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn-secondary px-2.5 py-1.5"
                  disabled={!lastDay || detail.isFetching}
                  onClick={() => {
                    setHistory((h) => [...h, from ?? '']);
                    if (lastDay) setFrom(addDays(lastDay, 1));
                  }}
                  aria-label="Next week"
                >
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
            <AvailabilityLegend />
            <AvailabilityGrid
              days={availability}
              units={equipment.units}
              selection={selection}
              onSelect={onSelect}
            />
          </section>

          <section aria-labelledby="request-title" className="card p-5 lg:col-span-2">
            <h2 id="request-title" className="section-title mb-4">
              {equipment.requiresApproval ? 'Request access' : 'Book a slot'}
            </h2>
            {isStudent ? (
              <BookingForm
                key={equipment.id}
                equipment={equipment}
                lab={lab}
                selection={selection}
                initialProject={prefill.project}
                onHoursChange={(hours) => setSelection((s) => (s ? { ...s, hours } : s))}
                onUseAlternative={useAlternative}
              />
            ) : (
              <p className="text-sm text-slate-600">
                Bookings are made by students. Switch to a student profile in the header to try the
                booking flow.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
