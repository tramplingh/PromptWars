import type { AiSource, Equipment } from '@lablink/shared';
import { SYNONYMS, tokenize } from './language.js';
import type { ProposedStep } from './sanitise.js';

export interface Decomposition {
  source: AiSource;
  title: string;
  summary: string;
  steps: ProposedStep[];
}

const MAX_STEPS = 6;
const TAGS_PER_STEP = 3;
const DEFAULT_STEP_HOURS = 2;

/**
 * Capability tags implied by free text (direct tag words plus everyday synonyms),
 * ordered by where they are first mentioned — students usually describe steps in order.
 */
export function wantedTags(text: string, catalog: readonly Equipment[]): string[] {
  const vocabulary = new Set(catalog.flatMap((e) => e.capabilities));
  const firstMention = new Map<string, number>();
  tokenize(text).forEach((token, position) => {
    const direct = [...vocabulary].filter(
      (tag) => token.length >= 3 && tag.split('-').includes(token),
    );
    for (const tag of [...(SYNONYMS[token] ?? []), ...direct]) {
      if (vocabulary.has(tag) && !firstMention.has(tag)) firstMention.set(tag, position);
    }
  });
  return [...firstMention.entries()].sort((a, b) => a[1] - b[1]).map(([tag]) => tag);
}

const ACRONYMS: Record<string, string> = {
  pcb: 'PCB',
  rf: 'RF',
  emg: 'EMG',
  ecg: 'ECG',
  eeg: 'EEG',
  gpu: 'GPU',
  cuda: 'CUDA',
  fdm: 'FDM',
  sla: 'SLA',
  pcr: 'PCR',
  vr: 'VR',
  '3d': '3D',
  ai: 'AI',
  emi: 'EMI',
  cnc: 'CNC',
  hci: 'HCI',
};

/** "pcb-milling" → "PCB milling". */
export function humanizeTag(tag: string): string {
  const [first = '', ...rest] = tag.split('-').map((w) => ACRONYMS[w] ?? w);
  const capitalised =
    first === first.toLowerCase() ? first.charAt(0).toUpperCase() + first.slice(1) : first;
  return [capitalised, ...rest].join(' ');
}

/**
 * Groups mentioned capabilities into machine-sized steps: the earliest-mentioned
 * remaining tag is the next step's primary need, served by the device covering
 * the most remaining tags.
 */
export function groupByDevice(tags: readonly string[], devices: readonly Equipment[]): string[][] {
  const remaining = [...tags];
  const groups: string[][] = [];
  while (groups.length < MAX_STEPS) {
    const [primary] = remaining;
    if (primary === undefined) break;
    const covered = devices
      .filter((e) => e.capabilities.includes(primary))
      .map((e) => remaining.filter((t) => e.capabilities.includes(t)))
      .sort((a, b) => b.length - a.length)[0] ?? [primary];
    groups.push(covered.slice(0, TAGS_PER_STEP));
    for (const tag of covered) remaining.splice(remaining.indexOf(tag), 1);
  }
  return groups;
}

/** Rule-based project breakdown: one step per machine, in order of mention, chained sequentially. */
export function decomposeFallback(
  description: string,
  catalog: readonly Equipment[],
): Decomposition {
  const operational = catalog.filter((e) => e.status === 'operational');
  const tags = wantedTags(description, catalog).filter((tag) =>
    operational.some((e) => e.capabilities.includes(tag)),
  );
  const steps = groupByDevice(tags, operational).map((requirements, i) => ({
    id: `s${i + 1}`,
    title: humanizeTag(requirements[0] ?? 'lab work'),
    purpose: `Needs ${requirements.join(', ')}.`,
    requirements,
    hours: DEFAULT_STEP_HOURS,
    dependsOn: i > 0 ? [`s${i}`] : [],
  }));
  const title = description
    .trim()
    .split(/\s+/)
    .slice(0, 7)
    .join(' ')
    .replace(/[.,;:!?]+$/, '');
  return { source: 'fallback', title, summary: description.trim().slice(0, 600), steps };
}
