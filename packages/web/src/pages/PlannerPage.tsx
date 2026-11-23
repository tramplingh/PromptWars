import {
  planRequestSchema,
  type PlanBookingResult,
  type ProjectPlanResponse,
} from '@lablink/shared';
import { useState } from 'react';
import { PlanResult } from '../components/planner/PlanResult';
import { PlannerForm } from '../components/planner/PlannerForm';
import { useToast } from '../components/Toast';
import { errorMessage } from '../lib/api';
import { planBookingInput } from '../lib/planItems';
import { useBookPlan, usePlanProject } from '../lib/queries';

/** Describe a project once; get a feasible, dependency-ordered, multi-equipment timetable. */
export function PlannerPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [booked, setBooked] = useState<PlanBookingResult | null>(null);
  const plan = usePlanProject();
  const book = useBookPlan();
  const notify = useToast();

  const requestPlan = (description: string, deadline: string) => {
    const parsed = planRequestSchema.safeParse({ description, deadline });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please check the form');
      return;
    }
    setFormError(null);
    setBooked(null);
    plan.mutate(parsed.data, { onError: (error) => setFormError(errorMessage(error)) });
  };

  const bookAll = (result: ProjectPlanResponse) =>
    book.mutate(planBookingInput(result), {
      onSuccess: (res) => {
        setBooked(res);
        const ok = res.results.filter((r) => r.outcome !== 'failed').length;
        notify(
          `${ok} of ${res.results.length} sessions booked or requested.`,
          ok === res.results.length ? 'success' : 'info',
        );
      },
      onError: (error) => notify(errorMessage(error), 'error'),
    });

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

      <PlannerForm busy={plan.isPending} error={formError} onPlan={requestPlan} />

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
