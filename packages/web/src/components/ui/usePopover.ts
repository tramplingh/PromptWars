import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * Disclosure state for popovers and menus: closes on Escape (returning focus
 * to the trigger) and on outside clicks.
 */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<T>(null);
  const panelId = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target))
        close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, close]);

  return {
    open,
    setOpen,
    close,
    triggerRef,
    panelRef,
    triggerProps: {
      ref: triggerRef,
      'aria-expanded': open,
      'aria-controls': panelId,
      onClick: () => setOpen((o) => !o),
    },
    panelId,
  };
}
