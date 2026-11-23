import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession, useSwitchPersona } from './queries';

/** First-time visitors start as a student so the app is usable immediately — no login step. */
export const DEFAULT_PERSONA = 's-priya';

/** Selects the default demo persona when the visitor has no session yet. */
export function useDefaultPersona(): void {
  const { data: session, isSuccess } = useSession();
  const { mutate: selectPersona, isIdle } = useSwitchPersona();
  useEffect(() => {
    if (isSuccess && !session.persona && isIdle) selectPersona(DEFAULT_PERSONA);
  }, [isSuccess, session, isIdle, selectPersona]);
}

/** A boolean UI preference remembered in localStorage (silently in-memory if storage is blocked). */
export function usePersistentFlag(key: string): [boolean, () => void] {
  const [value, setValue] = useState(() => {
    try {
      return window.localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setValue((current) => {
      try {
        window.localStorage.setItem(key, current ? '0' : '1');
      } catch {
        // Preference simply isn't remembered.
      }
      return !current;
    });
  }, [key]);
  return [value, toggle];
}

/** Moves focus to the main region after client-side navigation, so screen readers announce the new page. */
export function useFocusOnNavigate(target: RefObject<HTMLElement>): void {
  const { pathname } = useLocation();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    target.current?.focus();
  }, [pathname, target]);
}

/** Focusable elements inside `container`, in DOM order. */
function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
}

/**
 * Modal focus management: focuses the first control on open, keeps Tab and
 * Shift+Tab inside the container, and calls `onEscape` when Escape is pressed.
 */
export function useFocusTrap(
  active: boolean,
  container: RefObject<HTMLElement>,
  onEscape: () => void,
): void {
  useEffect(() => {
    const root = container.current;
    if (!active || !root) return;
    focusableIn(root)[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onEscape();
      if (event.key !== 'Tab') return;
      const wrapTo = wrapTarget(focusableIn(root), document.activeElement, event.shiftKey);
      if (wrapTo) {
        event.preventDefault();
        wrapTo.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, container, onEscape]);
}

/** Where focus should wrap to when tabbing past either end of a trapped region (null = no wrap). */
export function wrapTarget(
  focusable: HTMLElement[],
  current: Element | null,
  backwards: boolean,
): HTMLElement | null {
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return null;
  if (backwards) return current === first ? last : null;
  return current === last ? first : null;
}
