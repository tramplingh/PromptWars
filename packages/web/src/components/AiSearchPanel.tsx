import type { AiSearchResponse } from '@lablink/shared';
import { Loader2, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/api';
import { useAiSearch, useCatalogIndex, useLiveStatus } from '../lib/queries';
import { AiSourceBadge } from './Badges';
import { EquipmentCard } from './EquipmentCard';
import { EmptyState } from './States';

const EXAMPLES = [
  'Capture muscle EMG signals for a prosthetic hand',
  'Train a deep-learning model on 40k images',
  'Cut acrylic parts for a drone frame',
  'Debug I2C communication on my circuit',
];

interface Props {
  /** Query to run immediately (e.g. from the top-bar "Ask LabLink" box). */
  initialQuery?: string;
  compact?: boolean;
}

/** Natural-language equipment matcher (Gemini, with rule-based fallback). */
export function AiSearchPanel({ initialQuery, compact = false }: Props) {
  const aiSearch = useAiSearch();
  const index = useCatalogIndex();
  const { byId: live } = useLiveStatus();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [result, setResult] = useState<{ query: string; response: AiSearchResponse } | null>(null);
  const inputId = useId();
  const resultsId = useId();

  const { mutate } = aiSearch;
  const run = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 3) return;
    mutate(trimmed, { onSuccess: (response) => setResult({ query: trimmed, response }) });
  };
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      runRef.current(initialQuery);
    }
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
            disabled={aiSearch.isPending || query.trim().length < 3}
          >
            {aiSearch.isPending ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Search aria-hidden="true" className="h-4 w-4" />
            )}
            {aiSearch.isPending ? 'Matching…' : 'Find equipment'}
          </button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Example searches">
          {EXAMPLES.slice(0, compact ? 3 : 4).map((example) => (
            <li key={example}>
              <button
                type="button"
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/25"
                onClick={() => {
                  setQuery(example);
                  run(example);
                }}
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div id={resultsId} aria-live="polite">
        {aiSearch.isError && (
          <p role="alert" className="px-5 py-4 text-sm text-rose-700">
            {errorMessage(aiSearch.error)}
          </p>
        )}
        {result && (
          <section aria-label={`Best matches for “${result.query}”`} className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Best matches for “{result.query}”</h3>
              <AiSourceBadge source={result.response.source} />
              <button
                type="button"
                className="btn-ghost ml-auto px-2 py-1 text-xs"
                onClick={() => setResult(null)}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
            {result.response.results.length === 0 ? (
              <EmptyState title="No close matches">
                Try describing the measurement or process you need, not the device name.
              </EmptyState>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {result.response.results.map((r) => {
                  const item = index.equipment.get(r.equipmentId);
                  if (!item) return null;
                  return (
                    <li key={r.equipmentId} className="flex">
                      <EquipmentCard
                        equipment={item}
                        lab={index.labs.get(item.labId)}
                        department={index.departments.get(item.departmentId)}
                        status={live.get(item.id)}
                        reason={r.reason}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
