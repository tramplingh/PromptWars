import type { Alternative, Equipment, Lab, ProjectInput } from '@lablink/shared';
import { Loader2 } from 'lucide-react';
import { useId, type FormEvent } from 'react';
import { maxBookableHours, type Selection } from '../../lib/bookingValidation';
import { AlternativesPanel, RequestAssistant, SlotSummary } from './BookingPanels';
import { CapabilityPicker, DurationField, TextField } from './FormFields';
import { useBookingForm } from './useBookingForm';

interface Props {
  equipment: Equipment;
  lab: Lab;
  selection: Selection | null;
  onHoursChange: (hours: number) => void;
  onUseAlternative: (alternative: Alternative, project: ProjectInput) => void;
  initialProject?: ProjectInput;
}

/** Booking / access-request form for one device, with AI drafting and fair alternatives on conflict. */
export function BookingForm({
  equipment,
  lab,
  selection,
  onHoursChange,
  onUseAlternative,
  initialProject,
}: Props) {
  const slotErrorId = useId();
  const maxHours = maxBookableHours(equipment.maxHoursPerBooking, lab.closeHour, selection);
  const form = useBookingForm({ equipment, selection, maxHours, initialProject, onHoursChange });
  const { project, errors } = form;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    form.submit();
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-6"
      aria-describedby={errors.slot ? slotErrorId : undefined}
    >
      <RequestAssistant
        busy={form.draft.isPending}
        draft={form.draft.data}
        onDraft={form.runDraft}
      />
      <SlotSummary selection={selection} error={errors.slot} errorId={slotErrorId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <DurationField
          hours={selection?.hours ?? 1}
          max={maxHours}
          disabled={!selection}
          onChange={onHoursChange}
        />
        <TextField
          label="Project deadline"
          type="date"
          value={project.deadline}
          min={selection?.date}
          onChange={(deadline) => form.update({ deadline })}
          error={errors.deadline}
          hint="Closer deadlines get higher priority when requests overlap."
        />
      </div>
      <TextField
        label="Project title"
        value={project.title}
        maxLength={120}
        onChange={(title) => form.update({ title })}
        error={errors.title}
      />
      <TextField
        label="What will you do on this equipment?"
        multiline
        value={project.summary}
        maxLength={1000}
        onChange={(summary) => form.update({ summary })}
        error={errors.summary}
      />
      <CapabilityPicker
        options={equipment.capabilities}
        selected={project.requirements}
        onToggle={form.toggleRequirement}
      />

      {form.alternatives && (
        <AlternativesPanel
          alternatives={form.alternatives}
          onUse={(alt) => onUseAlternative(alt, project)}
        />
      )}

      <button type="submit" className="btn-primary w-full py-3" disabled={form.submitting}>
        {form.submitting && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {equipment.requiresApproval ? 'Send request for approval' : 'Book now'}
      </button>
    </form>
  );
}
