import { addDays } from '@lablink/shared';
import { Sparkles, Workflow } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { localToday } from '../../lib/format';
import { BusyIcon } from '../ui/BusyIcon';

const EXAMPLES = [
  'Final-year drone: mill the flight-controller PCB, debug the I2C sensors on an oscilloscope, then laser-cut the acrylic frame.',
  'Wearable ECG patch: record heart signals with biosignal sensors, prototype on an STM32 board and 3D-print the enclosure.',
  'Crop disease detection: train a vision model on leaf images, then deploy it on an edge-AI board with a camera.',
];
const DEFAULT_DEADLINE_DAYS = 14;
const MAX_DEADLINE_DAYS = 30;

interface Props {
  busy: boolean;
  error: string | null;
  onPlan: (description: string, deadline: string) => void;
}

/** Project description + deadline, with one-click examples. */
export function PlannerForm({ busy, error, onPlan }: Props) {
  const ids = { description: useId(), deadline: useId(), error: useId() };
  const today = localToday();
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(addDays(today, DEFAULT_DEADLINE_DAYS));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onPlan(description, deadline);
  };
  const tryExample = (example: string) => {
    setDescription(example);
    onPlan(example, deadline);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="card overflow-hidden">
      <div className="bg-gradient-to-r from-brand-800 to-violet-700 px-6 py-5 text-white">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Workflow aria-hidden="true" className="h-4 w-4" /> What are you building?
        </h2>
        <p className="mt-1 text-sm text-blue-100">
          Mention the processes involved — milling, debugging, printing, training, imaging…
        </p>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_12rem]">
        <div>
          <label htmlFor={ids.description} className="field-label">
            Project description
          </label>
          <textarea
            id={ids.description}
            className="field min-h-[6.5rem]"
            value={description}
            maxLength={1500}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? ids.error : undefined}
            placeholder="e.g. Final-year drone: mill the PCB, debug the sensors, laser-cut the frame"
          />
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor={ids.deadline} className="field-label">
              Project deadline
            </label>
            <input
              id={ids.deadline}
              type="date"
              className="field"
              value={deadline}
              min={today}
              max={addDays(today, MAX_DEADLINE_DAYS)}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-ai mt-auto w-full py-2.5" disabled={busy}>
            <BusyIcon busy={busy} icon={Sparkles} />
            {busy ? 'Planning…' : 'Plan my project'}
          </button>
        </div>
        {error && (
          <p id={ids.error} role="alert" className="field-error md:col-span-2">
            {error}
          </p>
        )}
        <div className="md:col-span-2">
          <p className="eyebrow mb-2">Try an example</p>
          <ul className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-left text-xs text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                  onClick={() => tryExample(example)}
                >
                  {example.split(':')[0]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </form>
  );
}
