import {
  addDays,
  type Alternative,
  type BookingOutcome,
  type Equipment,
  type ProjectInput,
  type SlotTakenDetails,
} from '@lablink/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClientError, errorMessage } from '../../lib/api';
import { validateBooking, type FieldErrors, type Selection } from '../../lib/bookingValidation';
import { useAiDraft, useCreateBooking } from '../../lib/queries';
import { useToast } from '../Toast';

const OUTCOME_MESSAGE: Record<BookingOutcome, string> = {
  confirmed: 'Booked! Your slot is confirmed.',
  'awaiting-approval': 'Request sent. The faculty in-charge will review it shortly.',
  'queued-for-resolution':
    'Others requested this time too. Your request joined the fair-allocation queue.',
};
/** Default deadline suggested after an AI draft, relative to the chosen slot. */
const DRAFT_DEADLINE_DAYS = 14;

const EMPTY_PROJECT: ProjectInput = { title: '', summary: '', deadline: '', requirements: [] };

/** Only "slot taken" conflicts carry alternatives; other errors (e.g. own overlap) just show a message. */
function alternativesFrom(error: unknown): Alternative[] | null {
  const details =
    error instanceof ApiClientError ? (error.details as SlotTakenDetails | undefined) : undefined;
  return Array.isArray(details?.alternatives) ? details.alternatives : null;
}

interface Options {
  equipment: Equipment;
  selection: Selection | null;
  maxHours: number;
  initialProject?: ProjectInput;
  onHoursChange: (hours: number) => void;
}

/** State and actions for the booking form: project fields, AI drafting, validation and submission. */
export function useBookingForm({
  equipment,
  selection,
  maxHours,
  initialProject,
  onHoursChange,
}: Options) {
  const [project, setProject] = useState<ProjectInput>(initialProject ?? EMPTY_PROJECT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const draft = useAiDraft();
  const create = useCreateBooking();
  const notify = useToast();
  const navigate = useNavigate();

  const update = (patch: Partial<ProjectInput>) => setProject((p) => ({ ...p, ...patch }));
  const toggleRequirement = (tag: string) =>
    setProject((p) => ({
      ...p,
      requirements: p.requirements.includes(tag)
        ? p.requirements.filter((t) => t !== tag)
        : [...p.requirements, tag],
    }));

  const runDraft = (idea: string) =>
    draft.mutate(
      { equipmentId: equipment.id, idea },
      {
        onSuccess: (result) => {
          const deadline =
            project.deadline || (selection ? addDays(selection.date, DRAFT_DEADLINE_DAYS) : '');
          setProject({
            title: result.title,
            summary: result.summary,
            requirements: result.requirements,
            deadline,
          });
          onHoursChange(Math.min(result.suggestedHours, maxHours));
          notify('Draft ready — review and edit before sending.', 'info');
        },
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    );

  const submit = () => {
    setAlternatives(null);
    const result = validateBooking(equipment.id, selection, project);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    create.mutate(result.input, {
      onSuccess: ({ outcome }) => {
        notify(OUTCOME_MESSAGE[outcome]);
        navigate('/bookings');
      },
      onError: (error) => {
        setAlternatives(alternativesFrom(error));
        notify(errorMessage(error), 'error');
      },
    });
  };

  return {
    project,
    update,
    toggleRequirement,
    errors,
    alternatives,
    draft,
    runDraft,
    submit,
    submitting: create.isPending,
  };
}
