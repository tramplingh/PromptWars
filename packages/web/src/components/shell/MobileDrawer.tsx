import type { Role } from '@lablink/shared';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { useFocusTrap } from '../../lib/shellHooks';
import { Sidebar } from './Sidebar';

interface Props {
  role: Role | undefined;
  pendingCount: number;
  onClose: () => void;
}

/** Off-canvas navigation for small screens: a modal dialog with a focus trap and Escape to close. */
export function MobileDrawer({ role, pendingCount, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, drawerRef, onClose);
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-72 animate-fade-in shadow-raised"
      >
        <Sidebar role={role} pendingCount={pendingCount} collapsed={false} onNavigate={onClose} />
        <button
          type="button"
          className="icon-btn absolute right-2 top-3.5"
          aria-label="Close navigation menu"
          onClick={onClose}
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
