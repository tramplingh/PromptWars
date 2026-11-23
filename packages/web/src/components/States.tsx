import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '../lib/api';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-slate-600">
      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertCircle aria-hidden="true" className="h-8 w-8 text-rose-600" />
      <p className="text-sm text-slate-700">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Inbox aria-hidden="true" className="h-8 w-8 text-slate-400" />
      <p className="font-semibold text-slate-800">{title}</p>
      {children && <div className="text-sm text-slate-600">{children}</div>}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card h-48 animate-pulse bg-slate-100" />
      ))}
    </div>
  );
}
