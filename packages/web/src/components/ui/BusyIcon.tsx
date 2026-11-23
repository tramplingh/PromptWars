import { Loader2, type LucideIcon } from 'lucide-react';

/** A button icon that turns into a spinner while its action is in flight. */
export function BusyIcon({
  busy,
  icon: Icon,
  className = 'h-4 w-4',
}: {
  busy: boolean;
  icon: LucideIcon;
  className?: string;
}) {
  return busy ? (
    <Loader2 aria-hidden="true" className={`${className} animate-spin`} />
  ) : (
    <Icon aria-hidden="true" className={className} />
  );
}
