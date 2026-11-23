import { checkInSchema, formatSlot } from '@lablink/shared';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import { useCheckIn, useSession } from '../lib/queries';

/** Target of the kiosk QR code: checks the signed-in student into their current session. */
export function CheckInPage() {
  const [params] = useSearchParams();
  const { data: session } = useSession();
  const checkIn = useCheckIn();
  const attempted = useRef(false);
  const parsed = checkInSchema.safeParse({
    equipmentId: params.get('e') ?? '',
    code: params.get('c') ?? '',
  });
  const role = session?.persona?.role;

  const { mutate } = checkIn;
  useEffect(() => {
    if (attempted.current || !parsed.success || role !== 'student') return;
    attempted.current = true;
    mutate(parsed.data);
  }, [parsed, role, mutate]);

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8 text-center" aria-live="polite">
        <h1 className="page-title">Check in</h1>
        <CheckInStatus validLink={parsed.success} role={role} checkIn={checkIn} />
        <Link to="/bookings" className="btn-secondary mt-6">
          Go to my bookings
        </Link>
      </div>
    </div>
  );
}

function CheckInStatus({
  validLink,
  role,
  checkIn,
}: {
  validLink: boolean;
  role: string | undefined;
  checkIn: ReturnType<typeof useCheckIn>;
}) {
  if (!validLink)
    return (
      <Result
        ok={false}
        title="This QR code isn’t valid"
        detail="Scan the code on the lab display again."
      />
    );
  if (role && role !== 'student') {
    return (
      <Result
        ok={false}
        title="Switch to a student profile"
        detail="Check-in is for students with a session on this device."
      />
    );
  }
  if (checkIn.isSuccess)
    return (
      <Result
        ok
        title={`Checked in to ${checkIn.data.equipmentName}`}
        detail={formatSlot(checkIn.data.slot)}
      />
    );
  if (checkIn.isError)
    return <Result ok={false} title="Couldn’t check you in" detail={errorMessage(checkIn.error)} />;
  return (
    <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-600">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Checking you in…
    </p>
  );
}

function Result({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <Icon
        aria-hidden="true"
        className={`h-12 w-12 ${ok ? 'text-emerald-600' : 'text-rose-600'}`}
      />
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="text-sm text-slate-600">{detail}</p>
    </div>
  );
}
