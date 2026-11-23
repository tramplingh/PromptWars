import { addDays, formatHour, type Alternative, type ProjectInput } from '@lablink/shared';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Timer,
  Users,
  Wrench,
} from 'lucide-react';
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
import { LiveStatusPill } from '../components/ui/LiveStatusPill';
import { useEquipmentDetail, useLiveStatus, useSession } from '../lib/queries';

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
  const { byId: live } = useLiveStatus();

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
        to="/equipment"
        className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> All equipment
      </Link>

      <header className="card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <CategoryIcon category={equipment.category} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              {department.name} · {equipment.category}
            </p>
            <h1 className="page-title mt-1">{equipment.name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">{equipment.description}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Capabilities">
              {equipment.capabilities.map((c) => (
                <li key={c} className="chip border-slate-200 bg-slate-50 text-slate-700">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-col sm:items-end">
            <LiveStatusPill status={live.get(equipment.id)} />
            {equipment.status === 'operational' && (
              <ApprovalBadge requiresApproval={equipment.requiresApproval} />
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 divide-slate-200 border-t border-slate-200 bg-slate-50/60 sm:grid-cols-4 sm:divide-x">
          {[
            { icon: MapPin, label: 'Location', value: `${lab.name}, ${lab.location}` },
            {
              icon: Clock,
              label: 'Opening hours',
              value: `${formatHour(lab.openHour)}–${formatHour(lab.closeHour)}, Mon–Fri`,
            },
            {
              icon: Users,
              label: 'Units',
              value: `${equipment.units} identical unit${equipment.units > 1 ? 's' : ''}`,
            },
            {
              icon: Timer,
              label: 'Max per booking',
              value: `${equipment.maxHoursPerBooking} hours`,
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2.5 px-5 py-3">
              <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <dt className="text-2xs text-slate-500">{label}</dt>
                <dd className="truncate text-sm font-medium text-ink">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
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
          <section aria-labelledby="availability-title" className="card min-w-0 lg:col-span-3">
            <div className="card-header">
              <h2 id="availability-title" className="card-title">
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
            <div className="space-y-4 p-5">
              <AvailabilityLegend />
              <AvailabilityGrid
                days={availability}
                units={equipment.units}
                selection={selection}
                onSelect={onSelect}
              />
            </div>
          </section>

          <section
            aria-labelledby="request-title"
            className="card min-w-0 self-start lg:col-span-2"
          >
            <h2 id="request-title" className="card-header card-title">
              {equipment.requiresApproval ? 'Request access' : 'Book a slot'}
            </h2>
            <div className="p-5">
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
                  Bookings are made by students. Switch to a student profile in the header to try
                  the booking flow.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
