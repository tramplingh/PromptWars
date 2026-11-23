import type { ActivityEvent, ActivityType } from '@lablink/shared';
import { localDateOf } from './format';

export type FeedTab = 'requests' | 'decisions' | 'reallocations';

/** Which activity types each feed tab shows. */
export const TAB_TYPES: Record<FeedTab, ActivityType[]> = {
  requests: ['requested', 'confirmed'],
  decisions: ['approved', 'declined', 'checked-in'],
  reallocations: ['reallocated', 'no-show', 'backfilled'],
};

export function tabCounts(events: readonly ActivityEvent[]): Record<FeedTab, number> {
  const count = (tab: FeedTab) => events.filter((e) => TAB_TYPES[tab].includes(e.type)).length;
  return {
    requests: count('requests'),
    decisions: count('decisions'),
    reallocations: count('reallocations'),
  };
}

/** Events for a tab, optionally only those newer than the viewer's last-seen marker. */
export function eventsForTab(
  events: readonly ActivityEvent[],
  tab: FeedTab,
  onlyUnreadSince?: string,
): ActivityEvent[] {
  return events.filter(
    (e) => TAB_TYPES[tab].includes(e.type) && (!onlyUnreadSince || e.at > onlyUnreadSince),
  );
}

/** Splits events into "Today" and "Earlier this week", dropping empty groups. */
export function groupByDay(
  events: readonly ActivityEvent[],
  today: string,
): [string, ActivityEvent[]][] {
  const groups: [string, ActivityEvent[]][] = [
    ['Today', events.filter((e) => localDateOf(e.at) === today)],
    ['Earlier this week', events.filter((e) => localDateOf(e.at) !== today)],
  ];
  return groups.filter(([, list]) => list.length > 0);
}
