import { formatSlot, type ScoredBooking } from '@lablink/shared';
import { Check, X } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '../../lib/api';
import { relativeTime } from '../../lib/format';
import { useDecision } from '../../lib/queries';
import { ScorePill } from '../ScoreBreakdown';
import { useToast } from '../Toast';

/** A single pending request with approve / decline and an optional note. */
export function PendingRow({ booking }: { booking: ScoredBooking }) {
  const decide = useDecision();
  const notify = useToast();
  const [note, setNote] = useState('');
  const noteId = useId();

  const submit = (decision: 'approve' | 'reject') =>
    decide.mutate(
      { id: booking.id, decision, note },
      {
        onSuccess: () =>
          notify(
            `${decision === 'approve' ? 'Approved' : 'Declined'} ${booking.userName}’s request.`,
          ),
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    );

  return (
    <li className="card grid gap-4 p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
      <ScorePill score={booking.score} />
      <div className="space-y-1">
        <p className="font-semibold">
          {booking.userName}{' '}
          <span className="font-normal text-slate-600">· {booking.equipmentName}</span>
        </p>
        <p className="text-sm text-slate-700">{booking.project.title}</p>
        <p className="text-sm text-slate-600">{booking.project.summary}</p>
        <p className="text-xs text-slate-500">
          {formatSlot(booking.slot)} · deadline {booking.project.deadline} · requested{' '}
          {relativeTime(booking.createdAt)}
        </p>
      </div>
      <div className="flex flex-col gap-2 md:w-64">
        <label htmlFor={noteId} className="sr-only">
          Note to {booking.userName} (optional)
        </label>
        <input
          id={noteId}
          className="field py-2"
          placeholder="Optional note to student"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1 px-3 py-2"
            disabled={decide.isPending}
            onClick={() => submit('approve')}
          >
            <Check aria-hidden="true" className="h-4 w-4" /> Approve
          </button>
          <button
            type="button"
            className="btn-danger flex-1 px-3 py-2"
            disabled={decide.isPending}
            onClick={() => submit('reject')}
          >
            <X aria-hidden="true" className="h-4 w-4" /> Decline
          </button>
        </div>
      </div>
    </li>
  );
}
