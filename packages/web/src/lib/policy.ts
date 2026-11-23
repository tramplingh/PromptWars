import { daysBetween } from '@lablink/shared';

/** Requests whose project deadline is this close are flagged urgent for reviewers. */
export const URGENT_DEADLINE_DAYS = 3;

export function isUrgent(deadline: string, today: string): boolean {
  return daysBetween(today, deadline) <= URGENT_DEADLINE_DAYS;
}
