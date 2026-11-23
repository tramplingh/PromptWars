import { formatSlot, type ActivityEvent, type ActivityType } from '@lablink/shared';
import { CalendarClock, CheckCheck } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { localDateOf, localToday } from '../lib/format';
import { useActivity, useSession } from '../lib/queries';
import { useLastSeen } from '../lib/seen';
import { ACTIVITY_ACCENT, activitySentence, timeOfDay } from './shell/activityText';
import { EmptyState, Loading } from './States';
import { Tabs } from './ui/Tabs';

type Tab = 'requests' | 'decisions' | 'reallocations';

const TAB_TYPES: Record<Tab, ActivityType[]> = {
  requests: ['requested', 'confirmed'],
  decisions: ['approved', 'declined', 'checked-in'],
  reallocations: ['reallocated', 'no-show', 'backfilled'],
};

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

/** Activity feed with tabs and an "only unread" switch, in the style of a customer-updates panel. */
export function UpdatesFeed() {
  const { data: session } = useSession();
  const persona = session?.persona;
  const activity = useActivity(Boolean(persona));
  const { lastSeen, markAllRead } = useLastSeen(persona?.id);
  const [tab, setTab] = useState<Tab>('requests');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const panelId = useId();
  const switchId = useId();

  const events = useMemo(() => activity.data ?? [], [activity.data]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(TAB_TYPES) as Tab[]).map((t) => [
          t,
          events.filter((e) => TAB_TYPES[t].includes(e.type)).length,
        ]),
      ) as Record<Tab, number>,
    [events],
  );

  const shown = events.filter(
    (e) => TAB_TYPES[tab].includes(e.type) && (!onlyUnread || e.at > lastSeen),
  );
  const today = localToday();
  const groups: [string, ActivityEvent[]][] = [
    ['Today', shown.filter((e) => localDateOf(e.at) === today)],
    ['Earlier this week', shown.filter((e) => localDateOf(e.at) !== today)],
  ];

  return (
    <section aria-labelledby={`${panelId}-title`} className="card flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1 pt-4">
        <h2 id={`${panelId}-title`} className="card-title">
          Updates
        </h2>
        <div className="flex items-center gap-3">
          <label
            htmlFor={switchId}
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
          >
            <button
              id={switchId}
              type="button"
              role="switch"
              aria-checked={onlyUnread}
              onClick={() => setOnlyUnread((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${onlyUnread ? 'bg-brand-700' : 'bg-slate-300'}`}
            >
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${onlyUnread ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
              />
            </button>
            Only unread
          </label>
          <button
            type="button"
            className="icon-btn h-8 w-8"
            onClick={markAllRead}
            aria-label="Mark all updates as read"
            title="Mark all as read"
          >
            <CheckCheck aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-5">
        <Tabs<Tab>
          label="Update type"
          panelId={panelId}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'requests', label: 'Requests', count: counts.requests },
            { id: 'decisions', label: 'Decisions', count: counts.decisions },
            { id: 'reallocations', label: 'Moves & releases', count: counts.reallocations },
          ]}
        />
      </div>

      <div id={panelId} role="tabpanel" className="max-h-[32rem] flex-1 overflow-y-auto px-5 py-4">
        {activity.isPending ? (
          <Loading label="Loading updates" />
        ) : shown.length === 0 ? (
          <EmptyState title={onlyUnread ? 'No unread updates' : 'Nothing here yet'} />
        ) : (
          groups
            .filter(([, list]) => list.length > 0)
            .map(([label, list]) => (
              <div key={label} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-sm font-medium text-slate-600">{label}</h3>
                <ul className="space-y-3">
                  {list.map((e) => (
                    <UpdateItem key={e.id} event={e} unread={e.at > lastSeen} />
                  ))}
                </ul>
              </div>
            ))
        )}
      </div>
    </section>
  );
}

function UpdateItem({ event, unread }: { event: ActivityEvent; unread: boolean }) {
  const chip = TYPE_CHIP[event.type];
  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">
          <Link to={`/equipment/${event.equipmentId}`} className="hover:underline">
            {activitySentence(event)}
          </Link>
          {unread && (
            <span className="ml-2 chip border-brand-200 bg-brand-50 px-1.5 py-0 text-2xs text-brand-800">
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
