import { useId, useRef, type KeyboardEvent } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** id of the element the tabs control. */
  panelId: string;
}

/** WAI-ARIA tablist with roving focus (arrow keys, Home/End). */
export function Tabs<T extends string>({ tabs, value, onChange, label, panelId }: TabsProps<T>) {
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    onChange(tab.id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-0.5 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={`${baseId}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium transition-colors ${
              selected
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-slate-600 hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded px-1.5 text-2xs font-semibold ${selected ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
