import type { AiSearchResponse } from '@lablink/shared';
import { Search, Sparkles } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/api';
import { useAiSearch } from '../lib/queries';
import { AiSearchResults } from './AiSearchResults';
import { BusyIcon } from './ui/BusyIcon';

const EXAMPLES = [
  'Capture muscle EMG signals for a prosthetic hand',
  'Train a deep-learning model on 40k images',
  'Cut acrylic parts for a drone frame',
  'Debug I2C communication on my circuit',
];
const MIN_QUERY_LENGTH = 3;

interface Props {
  /** Query to run immediately (e.g. from the top-bar "Ask LabLink" box). */
  initialQuery?: string;
  compact?: boolean;
}

/** Natural-language equipment matcher (Gemini, with rule-based fallback). */
export function AiSearchPanel({ initialQuery, compact = false }: Props) {
  const aiSearch = useAiSearch();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [result, setResult] = useState<{ query: string; response: AiSearchResponse } | null>(null);
  const inputId = useId();

  const run = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    setQuery(value);
    aiSearch.mutate(trimmed, { onSuccess: (response) => setResult({ query: trimmed, response }) });
  };
  // Run a query handed over from the top bar once, without re-subscribing to `run`.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (initialQuery) runRef.current(initialQuery);
  }, [initialQuery]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    run(query);
  };

  return (
    <section aria-labelledby={`${inputId}-title`} className="card overflow-hidden">
      <div
        className={`bg-gradient-to-r from-brand-800 to-violet-700 text-white ${compact ? 'px-5 py-5' : 'px-6 py-7'}`}
      >
        <h2
          id={`${inputId}-title`}
          className="flex items-center gap-2 text-base font-semibold text-white"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" /> Find equipment by describing your
          project
        </h2>
        {!compact && (
          <p className="mt-1 max-w-2xl text-sm text-blue-100">
            Gemini matches your need to instruments across every department — no need to know the
            device name.
          </p>
        )}
        <form
          onSubmit={onSubmit}
          role="search"
          aria-label="Equipment matcher"
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor={inputId} className="sr-only">
            Describe what you need
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            maxLength={300}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. I need to measure heart signals for a wearable"
            className="field h-11 flex-1 border-0 text-[15px]"
          />
          <button
            type="submit"
            className="btn h-11 bg-white px-5 text-brand-800 hover:bg-blue-50"
            disabled={aiSearch.isPending || query.trim().length < MIN_QUERY_LENGTH}
          >
            <BusyIcon busy={aiSearch.isPending} icon={Search} />
            {aiSearch.isPending ? 'Matching…' : 'Find equipment'}
          </button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Example searches">
          {EXAMPLES.slice(0, compact ? 3 : 4).map((example) => (
            <li key={example}>
              <button
                type="button"
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/25"
                onClick={() => run(example)}
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div aria-live="polite">
        {aiSearch.isError && (
          <p role="alert" className="px-5 py-4 text-sm text-rose-700">
            {errorMessage(aiSearch.error)}
          </p>
        )}
        {result && (
          <AiSearchResults
            query={result.query}
            response={result.response}
            onClear={() => setResult(null)}
          />
        )}
      </div>
    </section>
  );
}
