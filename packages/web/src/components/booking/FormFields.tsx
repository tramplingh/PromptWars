import { useId, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Helper text shown when there is no error. */
  hint?: ReactNode;
  maxLength?: number;
  multiline?: boolean;
  type?: 'text' | 'date';
  min?: string;
}

/** Labelled input/textarea with accessible error and hint wiring (aria-invalid + aria-describedby). */
export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  multiline = false,
  type = 'text',
  min,
}: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const describedBy = error || hint ? messageId : undefined;
  const common = {
    id,
    value,
    maxLength,
    className: multiline ? 'field min-h-[6rem]' : 'field',
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
  };
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {multiline ? (
        <textarea {...common} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} min={min} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && (
        <p id={messageId} className="field-error">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={messageId} className="mt-1.5 text-xs text-slate-600">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Toggle chips for the capability tags a request needs. */
export function CapabilityPicker({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <fieldset>
      <legend className="field-label">Capabilities you need</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((tag) => {
          const active = selected.includes(tag);
          const tone = active
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400';
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(tag)}
              className={`chip px-3 py-1.5 text-sm transition ${tone}`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Duration picker bounded by the device limit and lab closing time. */
export function DurationField({
  hours,
  max,
  disabled,
  onChange,
}: {
  hours: number;
  max: number;
  disabled: boolean;
  onChange: (hours: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        Duration
      </label>
      <select
        id={id}
        className="field"
        value={hours}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h} hour{h > 1 ? 's' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
