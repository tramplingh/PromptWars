import { formatSlot, type AiDraftResponse, type Alternative } from '@lablink/shared';
import { CalendarClock, Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import { toSlot, type Selection } from '../../lib/bookingValidation';
import { useCatalogIndex } from '../../lib/queries';
import { AiSourceBadge } from '../Badges';
import { BusyIcon } from '../ui/BusyIcon';

const MIN_IDEA_LENGTH = 10;

/** Gemini request assistant: turns the student's own words into a structured request. */
export function RequestAssistant({
  busy,
  draft,
  onDraft,
}: {
  busy: boolean;
  draft: AiDraftResponse | undefined;
  onDraft: (idea: string) => void;
}) {
  const [idea, setIdea] = useState('');
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-h`}
      className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-brand-50 p-4"
    >
      <h3 id={`${id}-h`} className="flex items-center gap-2 font-semibold text-violet-900">
        <Sparkles aria-hidden="true" className="h-4 w-4" /> Request assistant
      </h3>
      <label htmlFor={id} className="mt-1 block text-sm text-violet-900/80">
        Describe your project in your own words — Gemini drafts a clear request for faculty.
      </label>
      <textarea
        id={id}
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
          onClick={() => onDraft(idea)}
          disabled={busy || idea.trim().length < MIN_IDEA_LENGTH}
        >
          <BusyIcon busy={busy} icon={Sparkles} />
          {busy ? 'Drafting…' : 'Draft my request'}
        </button>
        {draft && <AiSourceBadge source={draft.source} />}
      </div>
    </section>
  );
}

/** The chosen slot in words, plus the "pick a time first" error. */
export function SlotSummary({
  selection,
  error,
  errorId,
}: {
  selection: Selection | null;
  error?: string;
  errorId: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm" aria-live="polite">
      <span className="flex items-center gap-2 font-medium text-slate-800">
        <CalendarClock aria-hidden="true" className="h-4 w-4 text-brand-600" />
        {selection ? formatSlot(toSlot(selection)) : 'No time selected yet'}
      </span>
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Fair alternatives offered by the server when the requested slot was just taken. */
export function AlternativesPanel({
  alternatives,
  onUse,
}: {
  alternatives: Alternative[];
  onUse: (alt: Alternative) => void;
}) {
  const index = useCatalogIndex();
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      role="alert"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
    >
      <h3 id={id} className="font-semibold text-amber-900">
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
                onClick={() => onUse(alt)}
              >
                Use this
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
