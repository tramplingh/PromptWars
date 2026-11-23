import type { BookingView } from '@lablink/shared';
import { ScanLine } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { errorMessage } from '../../lib/api';
import { useCheckIn } from '../../lib/queries';
import { useToast } from '../Toast';

const CODE_LENGTH = 6;

/** Enter the 6-character code shown on the lab kiosk (or scan its QR) to prove you are at the device. */
export function CheckInForm({ booking }: { booking: BookingView }) {
  const checkIn = useCheckIn();
  const notify = useToast();
  const [code, setCode] = useState('');
  const id = useId();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    checkIn.mutate(
      { equipmentId: booking.equipmentId, code },
      {
        onSuccess: () => notify(`Checked in to ${booking.equipmentName}. Enjoy your session!`),
        onError: (error) => notify(errorMessage(error), 'error'),
      },
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-teal-200 bg-teal-50/70 p-3"
    >
      <div className="min-w-[10rem] flex-1">
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-teal-900">
          Check in within 15 minutes of the start — enter the code on the lab display
        </label>
        <input
          id={id}
          className="field font-mono uppercase tracking-[0.3em]"
          value={code}
          maxLength={CODE_LENGTH}
          autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC234"
        />
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={checkIn.isPending || code.trim().length !== CODE_LENGTH}
      >
        <ScanLine aria-hidden="true" className="h-4 w-4" /> Check in
      </button>
    </form>
  );
}
