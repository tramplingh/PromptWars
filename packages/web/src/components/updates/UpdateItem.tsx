import { formatSlot, type ActivityEvent, type ActivityType } from '@lablink/shared';
import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ACTIVITY_ACCENT, activitySentence, timeOfDay } from '../shell/activityText';

const TYPE_CHIP: Record<ActivityType, { label: string; className: string }> = {
  requested: {
    label: 'Awaiting decision',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  confirmed: { label: 'Confirmed', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  approved: { label: 'Approved', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  declined: { label: 'Declined', className: 'border-rose-200 bg-rose-50 text-rose-800' },
  reallocated: {
    label: 'Reallocated',
    className: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  'checked-in': { label: 'Checked in', className: 'border-teal-200 bg-teal-50 text-teal-800' },
  'no-show': { label: 'No-show · released', className: 'border-rose-200 bg-rose-50 text-rose-800' },
  backfilled: { label: 'Backfilled', className: 'border-violet-200 bg-violet-50 text-violet-800' },
};

/** One activity event: sentence, time, and a card with deadline, project and slot. */
export function UpdateItem({ event, unread }: { event: ActivityEvent; unread: boolean }) {
  const chip = TYPE_CHIP[event.type];
  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">
          <Link to={`/equipment/${event.equipmentId}`} className="hover:underline">
            {activitySentence(event)}
          </Link>
          {unread && (
            <span className="chip ml-2 border-brand-200 bg-brand-50 px-1.5 py-0 text-2xs text-brand-800">
              NEW
            </span>
          )}
        </p>
        <time dateTime={event.at} className="shrink-0 text-xs tabular-nums text-slate-500">
          {timeOfDay(event.at)}
        </time>
      </div>
      <div
        className={`mt-2 overflow-hidden rounded-lg border border-l-4 border-slate-200 ${ACTIVITY_ACCENT[event.type]}`}
      >
        <p className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
          <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" /> Needed by {event.deadline}
        </p>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span className="text-slate-700">{event.projectTitle}</span>
          <span className={`chip ${chip.className}`}>{chip.label}</span>
          <span className="w-full text-xs text-slate-500">{formatSlot(event.slot)}</span>
          {event.note && (
            <span className="w-full text-xs italic text-slate-600">“{event.note}”</span>
          )}
        </div>
      </div>
    </li>
  );
}
