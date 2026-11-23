import { createBookingSchema, type CreateBookingInput, type ProjectInput } from '@lablink/shared';

/** A start time and duration picked on the availability grid. */
export interface Selection {
  date: string;
  startHour: number;
  hours: number;
}

export type BookingField = 'title' | 'summary' | 'deadline' | 'slot' | 'requirements';
export type FieldErrors = Partial<Record<BookingField, string>>;

export type ValidationResult =
  { ok: true; input: CreateBookingInput } | { ok: false; errors: FieldErrors };

export const toSlot = (s: Selection) => ({
  date: s.date,
  startHour: s.startHour,
  endHour: s.startHour + s.hours,
});

/**
 * Client-side mirror of the server's booking rules, for instant field-level
 * feedback (the server re-validates everything). Returns the first message per field.
 */
export function validateBooking(
  equipmentId: string,
  selection: Selection | null,
  project: ProjectInput,
): ValidationResult {
  if (!selection)
    return { ok: false, errors: { slot: 'Choose a start time on the calendar first.' } };

  const parsed = createBookingSchema.safeParse({ equipmentId, slot: toSlot(selection), project });
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = (issue.path[0] === 'project' ? issue.path[1] : 'slot') as BookingField;
      errors[field] ??= issue.message;
    }
    return { ok: false, errors };
  }
  if (parsed.data.project.deadline < parsed.data.slot.date) {
    return {
      ok: false,
      errors: { deadline: 'Your deadline must be on or after the booking date.' },
    };
  }
  return { ok: true, input: parsed.data };
}

/** Longest booking allowed from the chosen start: the device limit, capped by lab closing time. */
export function maxBookableHours(
  maxPerBooking: number,
  closeHour: number,
  selection: Selection | null,
): number {
  return selection
    ? Math.max(1, Math.min(maxPerBooking, closeHour - selection.startHour))
    : maxPerBooking;
}
