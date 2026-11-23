import type { Alternative, ProjectInput } from '@lablink/shared';
import { ArrowLeft, ScanLine, Wrench } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BookingForm } from '../components/booking/BookingForm';
import { AvailabilityCard } from '../components/equipment/AvailabilityCard';
import { EquipmentHeader } from '../components/equipment/EquipmentHeader';
import { ErrorState, Loading } from '../components/States';
import type { Selection } from '../lib/bookingValidation';
import { useEquipmentDetail, useLiveStatus, useSession } from '../lib/queries';
import { useWeekNavigation } from '../lib/useWeekNavigation';

/** Router state used to carry a chosen alternative (slot + project) to another device's page. */
interface PrefillState {
  selection?: Selection;
  project?: ProjectInput;
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
  const week = useWeekNavigation();
  const [selection, setSelection] = useState<Selection | null>(prefill.selection ?? null);
  const detail = useEquipmentDetail(id, week.from);
  const { data: session } = useSession();
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

  const useAlternative = (alt: Alternative, project: ProjectInput) => {
    const next = {
      date: alt.slot.date,
      startHour: alt.slot.startHour,
      hours: alt.slot.endHour - alt.slot.startHour,
    };
    if (alt.equipmentId === equipment.id) setSelection(next);
    else
      navigate(`/equipment/${alt.equipmentId}`, {
        state: { selection: next, project } satisfies PrefillState,
      });
  };

  return (
    <div className="space-y-6">
      <Link
        to="/equipment"
        className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> All equipment
      </Link>
      <EquipmentHeader
        equipment={equipment}
        lab={lab}
        department={department}
        status={live.get(equipment.id)}
      />

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
          <AvailabilityCard
            days={availability}
            units={equipment.units}
            selection={selection}
            onSelect={onSelect}
            canGoBack={week.canGoBack}
            busy={detail.isFetching}
            onPrevious={week.previous}
            onNext={() => week.next(availability.at(-1)?.date)}
          />
          <section
            aria-labelledby="request-title"
            className="card min-w-0 self-start lg:col-span-2"
          >
            <h2 id="request-title" className="card-header card-title">
              {equipment.requiresApproval ? 'Request access' : 'Book a slot'}
            </h2>
            <div className="p-5">
              {session?.persona?.role === 'student' ? (
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
                <StaffActions equipmentId={equipment.id} />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StaffActions({ equipmentId }: { equipmentId: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Bookings are made by students. Switch to a student profile in the top bar to try the booking
        flow.
      </p>
      <Link to={`/kiosk/${equipmentId}`} className="btn-secondary w-full">
        <ScanLine aria-hidden="true" className="h-4 w-4" /> Open lab kiosk display (check-in QR)
      </Link>
    </div>
  );
}
