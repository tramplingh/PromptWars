import { useCallback, useSyncExternalStore } from 'react';

/**
 * Per-viewer "last seen" marker for the updates feed. Stored in localStorage
 * as a convenience only: if storage is unavailable everything is simply unread.
 */
const KEY = (personaId: string) => `lablink:last-seen:${personaId}`;
const EVENT = 'lablink:last-seen';
const EPOCH = '1970-01-01T00:00:00.000Z';

function read(personaId: string): string {
  try {
    return window.localStorage.getItem(KEY(personaId)) ?? EPOCH;
  } catch {
    return EPOCH;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Returns the persona's last-seen timestamp and a function to mark everything as read. */
export function useLastSeen(personaId: string | undefined) {
  const lastSeen = useSyncExternalStore(
    subscribe,
    () => (personaId ? read(personaId) : EPOCH),
    () => EPOCH,
  );
  const markAllRead = useCallback(() => {
    if (!personaId) return;
    try {
      window.localStorage.setItem(KEY(personaId), new Date().toISOString());
    } catch {
      // Storage blocked (private mode): nothing to persist.
    }
    window.dispatchEvent(new Event(EVENT));
  }, [personaId]);
  return { lastSeen, markAllRead };
}
