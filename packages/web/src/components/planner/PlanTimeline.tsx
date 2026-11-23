import type { ProjectPlanResponse } from '@lablink/shared';
import { weekdayLabel } from '../../lib/format';
import { stepColor, timelineDays } from '../../lib/planItems';

/** Compact Gantt-style overview (decorative; the step list is the accessible source). */
export function PlanTimeline({ plan }: { plan: ProjectPlanResponse }) {
  const days = timelineDays(plan);
  if (days.length === 0) return null;
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
        {plan.steps.map((step, i) => {
          const dates = new Set(
            step.schedule.status === 'scheduled' ? step.schedule.sessions.map((s) => s.date) : [],
          );
          return (
            <div key={step.id} className="contents">
              <span className="truncate pr-2 text-xs font-medium text-slate-700">
                {i + 1}. {step.title}
              </span>
              {days.map((d) => (
                <span key={d} className="flex items-center px-0.5">
                  <span
                    className={`h-3 w-full rounded ${dates.has(d) ? stepColor(i) : 'bg-slate-100'}`}
                  />
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
