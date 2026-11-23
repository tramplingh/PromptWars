import { EQUIPMENT_CATEGORIES, type AiSearchResponse } from '@lablink/shared';
import { Search, Sparkles, X } from 'lucide-react';
import { useDeferredValue, useId, useMemo, useState, type FormEvent } from 'react';
import { AiSourceBadge } from '../components/Badges';
import { EquipmentCard } from '../components/EquipmentCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/States';
import { errorMessage } from '../lib/api';
import { useAiSearch, useCatalog, useCatalogIndex } from '../lib/queries';

const EXAMPLES = [
  'Capture muscle EMG signals for a prosthetic hand',
  'Train a deep-learning model on 40k images',
  'Cut acrylic parts for a drone frame',
  'Debug I2C communication on my circuit',
];

export function DiscoverPage() {
  const catalog = useCatalog();
  const index = useCatalogIndex();
  const aiSearch = useAiSearch();
  const [query, setQuery] = useState('');
  const [aiResult, setAiResult] = useState<{ query: string; response: AiSearchResponse } | null>(
    null,
  );

  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [instantOnly, setInstantOnly] = useState(false);
  const [text, setText] = useState('');
  const deferredText = useDeferredValue(text);
  const ids = { search: useId(), dept: useId(), cat: useId(), text: useId(), instant: useId() };

  const runSearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 3) return;
    aiSearch.mutate(trimmed, {
      onSuccess: (response) => setAiResult({ query: trimmed, response }),
    });
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    runSearch(query);
  };

  const filtered = useMemo(() => {
    const needle = deferredText.trim().toLowerCase();
    return (catalog.data?.equipment ?? []).filter(
      (e) =>
        (!department || e.departmentId === department) &&
        (!category || e.category === category) &&
        (!instantOnly || (!e.requiresApproval && e.status === 'operational')) &&
        (!needle ||
          `${e.name} ${e.description} ${e.capabilities.join(' ')}`.toLowerCase().includes(needle)),
    );
  }, [catalog.data, department, category, instantOnly, deferredText]);

  return (
    <div className="space-y-10">
      <section
        aria-labelledby="hero-title"
        className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 px-6 py-10 text-white sm:px-10"
      >
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-100">
          Campus lab sharing
        </p>
        <h1 id="hero-title" className="mt-2 max-w-2xl text-3xl font-bold text-white sm:text-4xl">
          Find the right equipment for your project — in any department.
        </h1>
        <p className="mt-3 max-w-2xl text-brand-100">
          Describe what you are building. LabLink’s Gemini-powered assistant matches your need to
          oscilloscopes, GPUs, fabrication tools and bio-lab instruments across campus.
        </p>

        <form
          onSubmit={onSubmit}
          role="search"
          className="mt-6 flex max-w-3xl flex-col gap-3 sm:flex-row"
        >
          <label htmlFor={ids.search} className="sr-only">
            Describe what you need
          </label>
          <div className="relative flex-1">
            <Sparkles
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-500"
            />
            <input
              id={ids.search}
              type="search"
              value={query}
              maxLength={300}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. I need to measure heart signals for a wearable"
              className="field h-12 rounded-2xl border-0 pl-12 text-base shadow-lg"
            />
          </div>
          <button
            type="submit"
            className="btn h-12 rounded-2xl bg-white px-6 text-brand-700 hover:bg-brand-50"
            disabled={aiSearch.isPending || query.trim().length < 3}
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            {aiSearch.isPending ? 'Matching…' : 'Find equipment'}
          </button>
        </form>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Example searches">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                className="rounded-full bg-white/15 px-3 py-1.5 text-sm text-white transition hover:bg-white/25"
                onClick={() => {
                  setQuery(example);
                  runSearch(example);
                }}
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div aria-live="polite">
        {aiSearch.isError && (
          <p role="alert" className="card px-5 py-4 text-sm text-rose-700">
            {errorMessage(aiSearch.error)}
          </p>
        )}
        {aiResult && (
          <section aria-labelledby="ai-results" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="ai-results" className="section-title">
                Best matches for “{aiResult.query}”
              </h2>
              <AiSourceBadge source={aiResult.response.source} />
              <button
                type="button"
                className="btn-ghost ml-auto px-3 py-1.5"
                onClick={() => setAiResult(null)}
              >
                <X aria-hidden="true" className="h-4 w-4" /> Clear
              </button>
            </div>
            {aiResult.response.results.length === 0 ? (
              <EmptyState title="No close matches">
                Try describing the measurement or process you need, not the device name.
              </EmptyState>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {aiResult.response.results.map((r) => {
                  const item = index.equipment.get(r.equipmentId);
                  if (!item) return null;
                  return (
                    <li key={r.equipmentId} className="flex">
                      <EquipmentCard
                        equipment={item}
                        lab={index.labs.get(item.labId)}
                        department={index.departments.get(item.departmentId)}
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

      <section aria-labelledby="catalog-title" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="catalog-title" className="section-title">
              Campus equipment catalogue
            </h2>
            <p className="text-sm text-slate-600">
              {filtered.length} of {catalog.data?.equipment.length ?? 0} items across{' '}
              {catalog.data?.departments.length ?? 0} departments
            </p>
          </div>
        </div>

        <div className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor={ids.text} className="field-label">
              Filter by keyword
            </label>
            <input
              id={ids.text}
              className="field"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. fpga, pcr, laser"
            />
          </div>
          <div>
            <label htmlFor={ids.dept} className="field-label">
              Department
            </label>
            <select
              id={ids.dept}
              className="field"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {catalog.data?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.cat} className="field-label">
              Category
            </label>
            <select
              id={ids.cat}
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {EQUIPMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label
              htmlFor={ids.instant}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-700"
            >
              <input
                id={ids.instant}
                type="checkbox"
                className="h-4 w-4 rounded accent-brand-600"
                checked={instantOnly}
                onChange={(e) => setInstantOnly(e.target.checked)}
              />
              Instant booking only
            </label>
          </div>
        </div>

        {catalog.isPending ? (
          <SkeletonGrid />
        ) : catalog.isError ? (
          <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nothing matches these filters">
            Clear a filter or try the AI search above.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <li key={item.id} className="flex">
                <EquipmentCard
                  equipment={item}
                  lab={index.labs.get(item.labId)}
                  department={index.departments.get(item.departmentId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
