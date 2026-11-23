import { useId } from 'react';

/** Accessible on/off toggle (role="switch") with a visible label. */
export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-brand-700' : 'bg-slate-300'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
        />
      </button>
      {label}
    </label>
  );
}
