import type { ActivityEvent } from '@lablink/shared';
import { ArrowRight, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { relativeTime } from '../../lib/format';
import { useActivity, useSession } from '../../lib/queries';
import { useLastSeen } from '../../lib/seen';
import { usePopover } from '../ui/usePopover';
import { activitySentence } from './activityText';

/** Bell with unread count and an alerts panel split into Unread / Seen. */
export function NotificationsPopover() {
  const { data: session } = useSession();
  const persona = session?.persona;
  const { data: events = [] } = useActivity(Boolean(persona));
  const { lastSeen, markAllRead } = useLastSeen(persona?.id);
  const popover = usePopover();

  const unread = events.filter((e) => e.at > lastSeen);
  const seen = events.filter((e) => e.at <= lastSeen).slice(0, 4);

  return (
    <div className="relative">
      <button
        type="button"
        className="icon-btn relative"
        aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`}
        {...popover.triggerProps}
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unread.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-2xs font-bold text-white"
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {popover.open && (
        <div
          id={popover.panelId}
          ref={popover.panelRef}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] animate-fade-in rounded-card border border-slate-200 bg-white shadow-raised"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold">Alerts</h2>
            <div className="flex items-center gap-1">
              {unread.length > 0 && (
                <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
              <Link
                to="/"
                className="btn-ghost px-2 py-1 text-xs text-brand-700"
                onClick={() => popover.close(false)}
              >
                View all
              </Link>
            </div>
          </div>
          <div className="max-h-[26rem] overflow-y-auto p-3">
            <EventSection
              title="Unread"
              events={unread.slice(0, 6)}
              highlight
              empty="You're all caught up."
            />
            {seen.length > 0 && <EventSection title="Seen" events={seen} />}
          </div>
        </div>
      )}
    </div>
  );
}

function EventSection({
  title,
  events,
  highlight = false,
  empty,
}: {
  title: string;
  events: ActivityEvent[];
  highlight?: boolean;
  empty?: string;
}) {
  return (
    <section className="mb-2">
      <h3 className="eyebrow mb-2 px-1">{title}</h3>
      {events.length === 0 ? (
        <p className="px-1 pb-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                to={`/equipment/${e.equipmentId}`}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                  highlight
                    ? 'border-rose-200 bg-rose-50/70 hover:bg-rose-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block font-medium ${highlight ? 'text-rose-950' : 'text-ink'}`}>
                    {activitySentence(e)}
                  </span>
                  <span className="text-xs text-slate-500">{relativeTime(e.at)}</span>
                </span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
