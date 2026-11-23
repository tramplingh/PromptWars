import { addDays } from '@lablink/shared';
import { useState } from 'react';

/**
 * Week-by-week paging for the availability grid. `from` is the first day to
 * show (undefined = today); a history stack lets "previous" return exactly.
 */
export function useWeekNavigation(initialFrom?: string) {
  const [from, setFrom] = useState<string | undefined>(initialFrom);
  const [history, setHistory] = useState<(string | undefined)[]>([]);

  const next = (lastShownDay: string | undefined) => {
    if (!lastShownDay) return;
    setHistory((h) => [...h, from]);
    setFrom(addDays(lastShownDay, 1));
  };
  const previous = () => {
    setFrom(history.at(-1));
    setHistory((h) => h.slice(0, -1));
  };

  return { from, next, previous, canGoBack: history.length > 0 };
}
