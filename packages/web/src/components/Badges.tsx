import type { AiSource, BookingStatus } from '@lablink/shared';
import { CheckCircle2, CircleSlash, Clock3, Sparkles, Wand2, XCircle } from 'lucide-react';

const STATUS: Record<BookingStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  pending: {
    label: 'Pending',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: Clock3,
  },
  approved: {
    label: 'Confirmed',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Declined',
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    icon: CircleSlash,
  },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, className, icon: Icon } = STATUS[status];
  return (
    <span className={`chip ${className}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/** Tells users honestly whether a result came from Gemini or the rule-based fallback. */
export function AiSourceBadge({ source }: { source: AiSource }) {
  return source === 'gemini' ? (
    <span className="chip border-violet-200 bg-violet-50 text-violet-800">
      <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
      Gemini
    </span>
  ) : (
    <span
      className="chip border-slate-200 bg-slate-100 text-slate-700"
      title="Gemini unavailable — deterministic rules used"
    >
      <Wand2 aria-hidden="true" className="h-3.5 w-3.5" />
      Smart rules
    </span>
  );
}

export function ApprovalBadge({ requiresApproval }: { requiresApproval: boolean }) {
  return requiresApproval ? (
    <span className="chip border-amber-200 bg-amber-50 text-amber-800">Faculty approval</span>
  ) : (
    <span className="chip border-emerald-200 bg-emerald-50 text-emerald-800">Instant booking</span>
  );
}
