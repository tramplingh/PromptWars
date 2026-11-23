import {
  addDays,
  createBookingSchema,
  formatSlot,
  type Alternative,
  type BookingOutcome,
  type Equipment,
  type Lab,
  type ProjectInput,
  type SlotTakenDetails,
} from '@lablink/shared';
import { CalendarClock, Loader2, Sparkles } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError, errorMessage } from '../lib/api';
import { useAiDraft, useCatalogIndex, useCreateBooking } from '../lib/queries';
import { AiSourceBadge } from './Badges';
import type { Selection } from './AvailabilityGrid';
import { useToast } from './Toast';

interface Props {
  equipment: Equipment;
  lab: Lab;
  selection: Selection | null;
  onHoursChange: (hours: number) => void;
  onUseAlternative: (alternative: Alternative, project: ProjectInput) => void;
  initialProject?: ProjectInput;
}

type FieldErrors = Partial<
  Record<'title' | 'summary' | 'deadline' | 'slot' | 'requirements', string>
>;

const OUTCOME_MESSAGE: Record<BookingOutcome, string> = {
  confirmed: 'Booked! Your slot is confirmed.',
  'awaiting-approval': 'Request sent. The faculty in-charge will review it shortly.',
  'queued-for-resolution':
    'Others requested this time too. Your request joined the fair-allocation queue.',
};

export function BookingForm({
  equipment,
  lab,
  selection,
  onHoursChange,
  onUseAlternative,
  initialProject,
}: Props) {
  const ids = {
    idea: useId(),
    title: useId(),
    summary: useId(),
    deadline: useId(),
    hours: useId(),
    reqs: useId(),
  };
  const [idea, setIdea] = useState('');
  const [title, setTitle] = useState(initialProject?.title ?? '');
  const [summary, setSummary] = useState(initialProject?.summary ?? '');
  const [deadline, setDeadline] = useState(initialProject?.deadline ?? '');
  const [requirements, setRequirements] = useState<string[]>(initialProject?.requirements ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);

  const draft = useAiDraft();
  const create = useCreateBooking();
  const notify = useToast();
  const navigate = useNavigate();
  const index = useCatalogIndex();

  const maxHours = selection
    ? Math.min(equipment.maxHoursPerBooking, lab.closeHour - selection.startHour)
    : equipment.maxHoursPerBooking;
  const project = (): ProjectInput => ({ title, summary, deadline, requirements });

  const toggleRequirement = (tag: string) =>
    setRequirements((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  const runDraft = () =>
    draft.mutate(
      { equipmentId: equipment.id, idea },
      {
        onSuccess: (result) => {
          setTitle(result.title);
          setSummary(result.summary);
          setRequirements(result.requirements);
          onHoursChange(Math.min(result.suggestedHours, maxHours));
          if (!deadline && selection) setDeadline(addDays(selection.date, 14));
          notify('Draft ready — review and edit before sending.', 'info');
        },
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAlternatives(null);
    if (!selection) {
      setErrors({ slot: 'Choose a start time on the calendar first.' });
      return;
    }
    const input = {
      equipmentId: equipment.id,
      slot: {
        date: selection.date,
        startHour: selection.startHour,
        endHour: selection.startHour + selection.hours,
      },
      project: project(),
    };
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] === 'project' ? issue.path[1] : 'slot') as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    if (parsed.data.project.deadline < parsed.data.slot.date) {
      setErrors({ deadline: 'Your deadline must be on or after the booking date.' });
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: ({ outcome }) => {
        notify(OUTCOME_MESSAGE[outcome]);
        navigate('/bookings');
      },
      onError: (error) => {
        // Only "slot taken" conflicts carry alternatives; other 409s (e.g. own overlap) just show the message.
        const details =
          error instanceof ApiClientError
            ? (error.details as SlotTakenDetails | undefined)
            : undefined;
        if (Array.isArray(details?.alternatives)) setAlternatives(details.alternatives);
        notify(errorMessage(error), 'error');
      },
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-6"
      aria-describedby={errors.slot ? `${ids.hours}-slot` : undefined}
    >
      <section
        aria-labelledby={`${ids.idea}-h`}
        className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-brand-50 p-4"
      >
        <h3 id={`${ids.idea}-h`} className="flex items-center gap-2 font-semibold text-violet-900">
          <Sparkles aria-hidden="true" className="h-4 w-4" /> Request assistant
        </h3>
        <label htmlFor={ids.idea} className="mt-1 block text-sm text-violet-900/80">
          Describe your project in your own words — Gemini drafts a clear request for faculty.
        </label>
        <textarea
          id={ids.idea}
          className="field mt-3 min-h-[5rem]"
          value={idea}
          maxLength={1000}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g. Final-year drone project, need to cut the acrylic frame and engrave our logo before the expo"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ai"
            onClick={runDraft}
            disabled={draft.isPending || idea.trim().length < 10}
          >
            {draft.isPending ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="h-4 w-4" />
            )}
            {draft.isPending ? 'Drafting…' : 'Draft my request'}
          </button>
          {draft.data && <AiSourceBadge source={draft.data.source} />}
        </div>
      </section>

      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm" aria-live="polite">
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <CalendarClock aria-hidden="true" className="h-4 w-4 text-brand-600" />
          {selection
            ? formatSlot({
                date: selection.date,
                startHour: selection.startHour,
                endHour: selection.startHour + selection.hours,
              })
            : 'No time selected yet'}
        </span>
        {errors.slot && (
          <p id={`${ids.hours}-slot`} className="field-error">
            {errors.slot}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.hours} className="field-label">
            Duration
          </label>
          <select
            id={ids.hours}
            className="field"
            value={selection?.hours ?? 1}
            onChange={(e) => onHoursChange(Number(e.target.value))}
            disabled={!selection}
          >
            {Array.from({ length: Math.max(1, maxHours) }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h} hour{h > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.deadline} className="field-label">
            Project deadline
          </label>
          <input
            id={ids.deadline}
            type="date"
            className="field"
            value={deadline}
            min={selection?.date}
            onChange={(e) => setDeadline(e.target.value)}
            aria-invalid={Boolean(errors.deadline)}
            aria-describedby={errors.deadline ? `${ids.deadline}-err` : `${ids.deadline}-hint`}
          />
          {errors.deadline ? (
            <p id={`${ids.deadline}-err`} className="field-error">
              {errors.deadline}
            </p>
          ) : (
            <p id={`${ids.deadline}-hint`} className="mt-1.5 text-xs text-slate-600">
              Closer deadlines get higher priority when requests overlap.
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={ids.title} className="field-label">
          Project title
        </label>
        <input
          id={ids.title}
          className="field"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${ids.title}-err` : undefined}
        />
        {errors.title && (
          <p id={`${ids.title}-err`} className="field-error">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={ids.summary} className="field-label">
          What will you do on this equipment?
        </label>
        <textarea
          id={ids.summary}
          className="field min-h-[6rem]"
          value={summary}
          maxLength={1000}
          onChange={(e) => setSummary(e.target.value)}
          aria-invalid={Boolean(errors.summary)}
          aria-describedby={errors.summary ? `${ids.summary}-err` : undefined}
        />
        {errors.summary && (
          <p id={`${ids.summary}-err`} className="field-error">
            {errors.summary}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="field-label">Capabilities you need</legend>
        <div className="flex flex-wrap gap-2">
          {equipment.capabilities.map((tag) => {
            const active = requirements.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleRequirement(tag)}
                className={`chip px-3 py-1.5 text-sm transition ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </fieldset>

      {alternatives && (
        <section
          aria-labelledby={`${ids.reqs}-alt`}
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <h3 id={`${ids.reqs}-alt`} className="font-semibold text-amber-900">
            That slot was just taken — here are fair alternatives
          </h3>
          {alternatives.length === 0 ? (
            <p className="mt-1 text-sm text-amber-900">
              No alternatives before your deadline. Try a later deadline or another week.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {alternatives.map((alt) => (
                <li
                  key={`${alt.equipmentId}-${alt.slot.date}-${alt.slot.startHour}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {index.equipment.get(alt.equipmentId)?.name ?? alt.equipmentId}
                    </span>
                    <span className="text-slate-600"> · {formatSlot(alt.slot)}</span>
                  </span>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1.5"
                    onClick={() => onUseAlternative(alt, project())}
                  >
                    Use this
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <button type="submit" className="btn-primary w-full py-3" disabled={create.isPending}>
        {create.isPending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {equipment.requiresApproval ? 'Send request for approval' : 'Book now'}
      </button>
    </form>
  );
}
