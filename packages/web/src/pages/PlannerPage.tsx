import {
  addDays,
  formatHour,
  formatSlot,
  planRequestSchema,
  workingDays,
  type BookingOutcome,
  type PlanBookingResult,
  type PlannedStepView,
  type ProjectPlanResponse,
} from '@lablink/shared';
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AiSourceBadge, ApprovalBadge } from '../components/Badges';
import { CategoryIcon } from '../components/CategoryIcon';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/api';
import { localToday, longDate, weekdayLabel } from '../lib/format';
import { useBookPlan, useCatalogIndex, usePlanProject } from '../lib/queries';

const EXAMPLES = [
  'Final-year drone: mill the flight-controller PCB, debug the I2C sensors on an oscilloscope, then laser-cut the acrylic frame.',
  'Wearable ECG patch: record heart signals with biosignal sensors, prototype on an STM32 board and 3D-print the enclosure.',
  'Crop disease detection: train a vision model on leaf images, then deploy it on an edge-AI board with a camera.',
];

const STEP_COLORS = [
  'bg-brand-600',
  'bg-violet-600',
  'bg-teal-600',
  'bg-orange-500',
  'bg-pink-600',
  'bg-emerald-600',
];

const OUTCOME: Record<
  BookingOutcome | 'failed',
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  confirmed: { label: 'Confirmed', className: 'text-emerald-700', icon: CheckCircle2 },
  'awaiting-approval': { label: 'Sent for approval', className: 'text-amber-700', icon: Clock },
  'queued-for-resolution': {
    label: 'Queued for fair resolution',
    className: 'text-violet-700',
    icon: Clock,
  },
  failed: { label: 'Not booked', className: 'text-rose-700', icon: XCircle },
};

/** Describe a project once; get a feasible, dependency-ordered, multi-equipment timetable. */
export function PlannerPage() {
  const ids = { description: useId(), deadline: useId(), error: useId() };
  const today = localToday();
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(addDays(today, 14));
  const [formError, setFormError] = useState<string | null>(null);
  const [booked, setBooked] = useState<PlanBookingResult | null>(null);
  const plan = usePlanProject();
  const book = useBookPlan();
  const notify = useToast();

  const submit = (text: string) => {
    const parsed = planRequestSchema.safeParse({ description: text, deadline });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please check the form');
      return;
    }
    setFormError(null);
    setBooked(null);
    plan.mutate(parsed.data, { onError: (error) => setFormError(errorMessage(error)) });
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(description);
  };

  const bookAll = (result: ProjectPlanResponse) => {
    const items = result.steps.flatMap((step) =>
      step.schedule.status === 'scheduled'
        ? step.schedule.sessions.map((slot) => ({
            equipmentId: step.schedule.status === 'scheduled' ? step.schedule.equipmentId : '',
            slot,
            requirements: step.requirements,
          }))
        : [],
    );
    book.mutate(
      {
        project: {
          title: result.title.slice(0, 120),
          summary:
            result.summary.length >= 20
              ? result.summary
              : `${result.summary} — multi-step lab project.`,
          deadline: result.deadline,
        },
        items,
      },
      {
        onSuccess: (res) => {
          setBooked(res);
          const ok = res.results.filter((r) => r.outcome !== 'failed').length;
          notify(
            `${ok} of ${res.results.length} sessions booked or requested.`,
            ok === res.results.length ? 'success' : 'info',
          );
        },
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Project planner</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Describe your whole project once. Gemini breaks it into steps; LabLink’s scheduler finds
          the best equipment across every department and a timetable that respects step order, lab
          hours, capacity, your other bookings and your deadline.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="card overflow-hidden">
        <div className="bg-gradient-to-r from-brand-800 to-violet-700 px-6 py-5 text-white">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Workflow aria-hidden="true" className="h-4 w-4" /> What are you building?
          </h2>
          <p className="mt-1 text-sm text-blue-100">
            Mention the processes involved — milling, debugging, printing, training, imaging…
          </p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_12rem]">
          <div>
            <label htmlFor={ids.description} className="field-label">
              Project description
            </label>
            <textarea
              id={ids.description}
              className="field min-h-[6.5rem]"
              value={description}
              maxLength={1500}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? ids.error : undefined}
              placeholder="e.g. Final-year drone: mill the PCB, debug the sensors, laser-cut the frame"
            />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor={ids.deadline} className="field-label">
                Project deadline
              </label>
              <input
                id={ids.deadline}
                type="date"
                className="field"
                value={deadline}
                min={today}
                max={addDays(today, 30)}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-ai mt-auto w-full py-2.5"
              disabled={plan.isPending}
            >
              {plan.isPending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" className="h-4 w-4" />
              )}
              {plan.isPending ? 'Planning…' : 'Plan my project'}
            </button>
          </div>
          {formError && (
            <p id={ids.error} role="alert" className="field-error md:col-span-2">
              {formError}
            </p>
          )}
          <div className="md:col-span-2">
            <p className="eyebrow mb-2">Try an example</p>
            <ul className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-left text-xs text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                    onClick={() => {
                      setDescription(example);
                      submit(example);
                    }}
                  >
                    {example.split(':')[0]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </form>

      <div aria-live="polite">
        {plan.data && (
          <PlanResult
            plan={plan.data}
            booking={book.isPending}
            booked={booked}
            onBook={() => bookAll(plan.data)}
          />
        )}
      </div>
    </div>
  );
}

function PlanResult({
  plan,
  booking,
  booked,
  onBook,
}: {
  plan: ProjectPlanResponse;
  booking: boolean;
  booked: PlanBookingResult | null;
  onBook: () => void;
}) {
  const index = useCatalogIndex();
  const sessionCount = plan.steps.reduce(
    (n, s) => n + (s.schedule.status === 'scheduled' ? s.schedule.sessions.length : 0),
    0,
  );
  const unscheduled = plan.steps.filter((s) => s.schedule.status === 'unschedulable').length;

  return (
    <section aria-labelledby="plan-title" className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="plan-title" className="text-lg font-semibold">
                {plan.title}
              </h2>
              <AiSourceBadge source={plan.source} />
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{plan.summary}</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={sessionCount === 0 || booking || booked !== null}
            onClick={onBook}
          >
            {booking ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
            )}
            {booked ? 'Booked' : `Book all ${sessionCount} session${sessionCount === 1 ? '' : 's'}`}
          </button>
        </div>

        <p
          className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            plan.feasible ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {plan.feasible ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {plan.feasible && plan.finish
            ? `Feasible: ${plan.steps.length} steps, ${sessionCount} sessions, finishing ${longDate(plan.finish.date)} at ${formatHour(plan.finish.hour)} — ${plan.slackDays} day${plan.slackDays === 1 ? '' : 's'} before your deadline.`
            : `${unscheduled} of ${plan.steps.length} steps can’t fit before ${longDate(plan.deadline)}. Book what fits, or move the deadline and plan again.`}
        </p>
      </div>

      <Timeline plan={plan} />

      <ol className="space-y-3" aria-label="Plan steps in order">
        {plan.steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            number={i + 1}
            plan={plan}
            index={index}
            color={STEP_COLORS[i % STEP_COLORS.length]!}
          />
        ))}
      </ol>

      {booked && (
        <section aria-labelledby="booked-title" className="card p-5">
          <h3 id="booked-title" className="card-title">
            Booking results
          </h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {booked.results.map((r) => {
              const o = OUTCOME[r.outcome];
              return (
                <li
                  key={`${r.equipmentId}-${r.slot.date}-${r.slot.startHour}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
                >
                  <o.icon aria-hidden="true" className={`h-4 w-4 ${o.className}`} />
                  <span className="font-medium text-ink">
                    {index.equipment.get(r.equipmentId)?.name}
                  </span>
                  <span className="text-slate-600">{formatSlot(r.slot)}</span>
                  <span className={`ml-auto text-xs font-medium ${o.className}`}>
                    {r.error ?? o.label}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link to="/bookings" className="btn-secondary mt-4">
            View my bookings
          </Link>
        </section>
      )}
    </section>
  );
}

/** Compact Gantt-style overview (decorative; the step list below is the accessible source). */
function Timeline({ plan }: { plan: ProjectPlanResponse }) {
  const sessions = plan.steps.flatMap((s, i) =>
    s.schedule.status === 'scheduled' ? s.schedule.sessions.map((slot) => ({ slot, i })) : [],
  );
  if (sessions.length === 0) return null;
  const first = sessions.reduce(
    (min, s) => (s.slot.date < min ? s.slot.date : min),
    sessions[0]!.slot.date,
  );
  const days = workingDays(first, 10)
    .filter((d) => d <= (plan.finish?.date ?? plan.deadline) || d <= sessions.at(-1)!.slot.date)
    .slice(0, 10);

  return (
    <div className="card overflow-x-auto p-5" aria-hidden="true">
      <div
        className="grid min-w-[36rem] gap-y-2"
        style={{ gridTemplateColumns: `9rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <span />
        {days.map((d) => (
          <span key={d} className="text-center text-2xs font-medium text-slate-500">
            {weekdayLabel(d)}
          </span>
        ))}
        {plan.steps.map((step, i) => (
          <div key={step.id} className="contents">
            <span className="truncate pr-2 text-xs font-medium text-slate-700">
              {i + 1}. {step.title}
            </span>
            {days.map((d) => {
              const here =
                step.schedule.status === 'scheduled' &&
                step.schedule.sessions.some((s) => s.date === d);
              return (
                <span key={d} className="flex items-center px-0.5">
                  <span
                    className={`h-3 w-full rounded ${here ? STEP_COLORS[i % STEP_COLORS.length] : 'bg-slate-100'}`}
                  />
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepCard({
  step,
  number,
  plan,
  index,
  color,
}: {
  step: PlannedStepView;
  number: number;
  plan: ProjectPlanResponse;
  index: ReturnType<typeof useCatalogIndex>;
  color: string;
}) {
  const s = step.schedule;
  const equipment = s.status === 'scheduled' ? index.equipment.get(s.equipmentId) : undefined;
  const lab = equipment ? index.labs.get(equipment.labId) : undefined;
  const department = equipment ? index.departments.get(equipment.departmentId) : undefined;
  const after = step.dependsOn
    .map((d) => plan.steps.findIndex((x) => x.id === d) + 1)
    .filter((n) => n > 0)
    .sort();

  return (
    <li className="card flex gap-4 p-4">
      <span
        aria-hidden="true"
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${color}`}
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            <span className="sr-only">Step {number}: </span>
            {step.title}
          </h3>
          <p className="text-sm text-slate-600">{step.purpose}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {step.requirements.map((r) => (
              <span key={r} className="chip border-slate-200 bg-slate-50 text-slate-700">
                {r}
              </span>
            ))}
            <span>
              · {step.hours}h{after.length > 0 && ` · after step ${after.join(', ')}`}
            </span>
          </p>
        </div>

        {s.status === 'scheduled' && equipment ? (
          <div className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <CategoryIcon category={equipment.category} size="sm" />
            <div className="min-w-0 flex-1">
              <Link
                to={`/equipment/${equipment.id}`}
                className="text-sm font-medium text-brand-800 hover:underline"
              >
                {equipment.name}
              </Link>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin aria-hidden="true" className="h-3 w-3" /> {department?.code} · {lab?.name}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {s.sessions.map((slot) => (
                  <li
                    key={`${slot.date}-${slot.startHour}`}
                    className="chip border-brand-200 bg-white text-brand-800"
                  >
                    {formatSlot(slot)}
                  </li>
                ))}
              </ul>
            </div>
            <ApprovalBadge requiresApproval={equipment.requiresApproval} />
          </div>
        ) : (
          s.status === 'unschedulable' && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {s.reason}
            </p>
          )
        )}
      </div>
    </li>
  );
}
