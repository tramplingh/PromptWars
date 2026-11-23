import {
  workingDays,
  type PlanBookingInput,
  type ProjectPlanResponse,
  type StepSchedule,
} from '@lablink/shared';

/** Distinct colours for up to six steps (cycled beyond that). */
export const STEP_COLORS = [
  'bg-brand-600',
  'bg-violet-600',
  'bg-teal-600',
  'bg-orange-500',
  'bg-pink-600',
  'bg-emerald-600',
];
const TIMELINE_DAYS = 10;
const MIN_SUMMARY_LENGTH = 20;

export const stepColor = (index: number): string =>
  STEP_COLORS[index % STEP_COLORS.length] ?? 'bg-brand-600';

type Scheduled = Extract<StepSchedule, { status: 'scheduled' }>;
const isScheduled = (s: StepSchedule): s is Scheduled => s.status === 'scheduled';

export function sessionCount(plan: ProjectPlanResponse): number {
  return plan.steps.reduce(
    (n, step) => n + (isScheduled(step.schedule) ? step.schedule.sessions.length : 0),
    0,
  );
}

/** Turns an accepted plan into the booking request for every scheduled session. */
export function planBookingInput(plan: ProjectPlanResponse): PlanBookingInput {
  const items = plan.steps.flatMap((step) => {
    const schedule = step.schedule;
    if (!isScheduled(schedule)) return [];
    return schedule.sessions.map((slot) => ({
      equipmentId: schedule.equipmentId,
      slot,
      requirements: step.requirements,
    }));
  });
  const summary =
    plan.summary.length >= MIN_SUMMARY_LENGTH
      ? plan.summary
      : `${plan.summary} — multi-step lab project.`;
  return { project: { title: plan.title.slice(0, 120), summary, deadline: plan.deadline }, items };
}

/** Working days spanned by the plan's sessions (at most ten), for the Gantt overview. */
export function timelineDays(plan: ProjectPlanResponse): string[] {
  const dates = plan.steps
    .flatMap((step) =>
      isScheduled(step.schedule) ? step.schedule.sessions.map((s) => s.date) : [],
    )
    .sort();
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) return [];
  return workingDays(first, TIMELINE_DAYS).filter((d) => d <= last);
}

/** 1-based step numbers this step waits for, in order. */
export function prerequisiteNumbers(
  plan: ProjectPlanResponse,
  dependsOn: readonly string[],
): number[] {
  return dependsOn
    .map((id) => plan.steps.findIndex((s) => s.id === id) + 1)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
}
