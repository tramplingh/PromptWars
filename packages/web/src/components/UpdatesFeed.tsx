import type { ActivityEvent } from '@lablink/shared';
import { CheckCheck } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { eventsForTab, groupByDay, tabCounts, type FeedTab } from '../lib/activityFeed';
import { localToday } from '../lib/format';
import { useActivity, useSession } from '../lib/queries';
import { useLastSeen } from '../lib/seen';
import { EmptyState, Loading } from './States';
import { UpdateItem } from './updates/UpdateItem';
import { Switch } from './ui/Switch';
import { Tabs } from './ui/Tabs';

/** Activity feed with tabs and an "only unread" switch. */
export function UpdatesFeed() {
  const { data: session } = useSession();
  const persona = session?.persona;
  const activity = useActivity(Boolean(persona));
  const { lastSeen, markAllRead } = useLastSeen(persona?.id);
  const [tab, setTab] = useState<FeedTab>('requests');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const panelId = useId();

  const events = useMemo(() => activity.data ?? [], [activity.data]);
  const counts = useMemo(() => tabCounts(events), [events]);
  const shown = eventsForTab(events, tab, onlyUnread ? lastSeen : undefined);

  return (
    <section aria-labelledby={`${panelId}-title`} className="card flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1 pt-4">
        <h2 id={`${panelId}-title`} className="card-title">
          Updates
        </h2>
        <div className="flex items-center gap-3">
          <Switch label="Only unread" checked={onlyUnread} onChange={setOnlyUnread} />
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
        <Tabs<FeedTab>
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
        ) : (
          <FeedGroups
            events={shown}
            lastSeen={lastSeen}
            emptyTitle={onlyUnread ? 'No unread updates' : 'Nothing here yet'}
          />
        )}
      </div>
    </section>
  );
}

function FeedGroups({
  events,
  lastSeen,
  emptyTitle,
}: {
  events: ActivityEvent[];
  lastSeen: string;
  emptyTitle: string;
}) {
  if (events.length === 0) return <EmptyState title={emptyTitle} />;
  return (
    <>
      {groupByDay(events, localToday()).map(([label, list]) => (
        <div key={label} className="mb-4 last:mb-0">
          <h3 className="mb-2 text-sm font-medium text-slate-600">{label}</h3>
          <ul className="space-y-3">
            {list.map((e) => (
              <UpdateItem key={e.id} event={e} unread={e.at > lastSeen} />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
