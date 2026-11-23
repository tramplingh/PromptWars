import type {
  AiDraftResponse,
  AllocationPlan,
  ConflictExplanation,
  Equipment,
  Insight,
  UtilisationReport,
} from '@lablink/shared';
import { formatHour, formatSlot } from '@lablink/shared';

/**
 * Deterministic fallbacks used when Gemini is not configured, times out or
 * returns invalid output. The product stays fully usable without AI.
 */

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'need',
  'want',
  'that',
  'this',
  'some',
  'something',
  'from',
  'can',
  'use',
  'using',
  'our',
  'project',
  'build',
  'make',
  'help',
  'about',
  'into',
  'like',
]);

/** Everyday words mapped to catalogue capability tags. */
const SYNONYMS: Record<string, string[]> = {
  muscle: ['emg'],
  emg: ['emg', 'biosignals'],
  heart: ['ecg'],
  ecg: ['ecg'],
  brain: ['eeg'],
  biomedical: ['biosignals'],
  ml: ['deep-learning'],
  ai: ['deep-learning', 'edge-ai'],
  neural: ['deep-learning'],
  train: ['model-training'],
  training: ['model-training'],
  model: ['model-training'],
  print: ['3d-printing'],
  printing: ['3d-printing'],
  printer: ['3d-printing'],
  cut: ['laser-cutting'],
  cutting: ['laser-cutting'],
  acrylic: ['laser-cutting'],
  engrave: ['engraving'],
  pcb: ['pcb-milling'],
  circuit: ['pcb-milling', 'oscilloscope'],
  debug: ['oscilloscope', 'protocol-decoding'],
  i2c: ['protocol-decoding'],
  spi: ['protocol-decoding'],
  dna: ['pcr', 'dna-amplification'],
  gene: ['pcr', 'genotyping'],
  cell: ['cell-imaging', 'microscopy'],
  cells: ['cell-imaging', 'microscopy'],
  microscope: ['microscopy'],
  antenna: ['antenna-testing'],
  radio: ['rf'],
  wireless: ['rf'],
  signal: ['signal-analysis'],
  signals: ['signal-analysis'],
  robot: ['robotics'],
  robotics: ['robotics'],
  vision: ['computer-vision'],
  camera: ['computer-vision'],
  image: ['computer-vision', 'imaging'],
  iot: ['sensors', 'microcontroller'],
  sensor: ['sensors'],
  sensors: ['sensors'],
  vr: ['vr'],
  virtual: ['vr'],
  fpga: ['fpga'],
  verilog: ['verilog'],
  gpu: ['gpu'],
  cuda: ['cuda'],
  prototype: ['prototyping'],
  enclosure: ['3d-printing', 'laser-cutting'],
  strength: ['tensile-testing'],
  tensile: ['tensile-testing'],
  wearable: ['wearables'],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function keywordSearch(
  query: string,
  catalog: readonly Equipment[],
  limit = 6,
): { equipmentId: string; reason: string }[] {
  const tokens = tokenize(query);
  const wantedTags = new Set(tokens.flatMap((t) => SYNONYMS[t] ?? []));

  return catalog
    .map((e) => {
      const matchedTags = e.capabilities.filter(
        (tag) =>
          wantedTags.has(tag) || tokens.some((t) => t.length >= 3 && tag.split('-').includes(t)),
      );
      const name = e.name.toLowerCase();
      const text = `${e.description} ${e.category}`.toLowerCase();
      const nameHits = tokens.filter((t) => t.length >= 3 && name.includes(t)).length;
      const textHits = tokens.filter((t) => t.length >= 3 && text.includes(t)).length;
      const score =
        matchedTags.length * 3 + nameHits * 2 + textHits + (e.status === 'operational' ? 0.5 : 0);
      return { e, score, matchedTags };
    })
    .filter((r) => r.score >= 1)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map(({ e, matchedTags }) => ({
      equipmentId: e.id,
      reason: matchedTags.length
        ? `Offers ${matchedTags.join(', ')}${e.status === 'maintenance' ? ' (currently under maintenance)' : ''}.`
        : `Related to your search: ${e.category.toLowerCase()} equipment.`,
    }));
}

export function draftFallback(equipment: Equipment, idea: string): AiDraftResponse {
  const words = idea.trim().split(/\s+/);
  const title = words
    .slice(0, 8)
    .join(' ')
    .replace(/[.,;:!?]+$/, '');
  const ideaTokens = new Set(tokenize(idea).flatMap((t) => [t, ...(SYNONYMS[t] ?? [])]));
  const matched = equipment.capabilities.filter(
    (c) => ideaTokens.has(c) || c.split('-').some((p) => ideaTokens.has(p)),
  );
  return {
    source: 'fallback',
    title: title.length >= 3 ? title : `Project using ${equipment.name}`,
    summary:
      idea.trim().length >= 20
        ? idea.trim()
        : `${idea.trim()} — work requiring the ${equipment.name}.`,
    requirements: (matched.length ? matched : equipment.capabilities.slice(0, 2)).slice(0, 5),
    suggestedHours: Math.min(2, equipment.maxHoursPerBooking),
  };
}

export function explainFallback(
  plan: AllocationPlan,
  names: { student: (userId: string) => string; equipment: (id: string) => string },
): ConflictExplanation {
  const target = names.equipment(plan.conflict.equipmentId);
  const window = `${formatHour(plan.conflict.startHour)}–${formatHour(plan.conflict.endHour)}`;
  const winners = plan.decisions
    .filter((d) => d.outcome === 'allocate')
    .map((d) => names.student(d.userId));
  const overview =
    `${plan.decisions.length} requests overlap on the ${target} (${window}). ` +
    `Priority weighs deadline urgency (40%), fair share of recent lab time (25%), capability fit (20%) and waiting time (15%). ` +
    (winners.length
      ? `${winners.join(' and ')} ${winners.length === 1 ? 'keeps' : 'keep'} the original slot. `
      : '') +
    plan.summary;

  const perStudent = plan.decisions.map((d) => {
    const who = names.student(d.userId);
    const [topReason] = d.score.reasons;
    if (d.outcome === 'allocate') {
      return {
        bookingId: d.bookingId,
        message: `${who} ranks #${d.rank} (score ${d.score.total}) — ${topReason?.toLowerCase()}. Keeps the requested slot.`,
      };
    }
    const alt = d.alternatives[0];
    const move = alt
      ? `Recommended move: ${names.equipment(alt.equipmentId)}, ${formatSlot(alt.slot)}.`
      : 'No feasible alternative before the deadline.';
    return {
      bookingId: d.bookingId,
      message: `${who} ranks #${d.rank} (score ${d.score.total}). ${move}`,
    };
  });

  return { source: 'fallback', overview, perStudent };
}

export function insightsFallback(report: UtilisationReport): Insight[] {
  const insights: Insight[] = [];
  const operational = report.items.filter((i) => i.capacityHours > 0);
  const busiest = operational.find((i) => i.utilisation >= 0.25 || i.pendingHours >= 4);
  if (busiest) {
    insights.push({
      title: `High demand on ${busiest.name}`,
      detail: `${Math.round(busiest.utilisation * 100)}% utilised with ${busiest.pendingHours}h still pending approval.`,
      action:
        'Extend opening hours or point students to equivalent equipment in other departments.',
    });
  }
  const idle = operational.filter((i) => i.approvedHours === 0 && i.pendingHours === 0).slice(0, 3);
  if (idle.length) {
    insights.push({
      title: `${idle.length} item${idle.length > 1 ? 's' : ''} sitting idle`,
      detail: `${idle.map((i) => i.name).join(', ')} had no bookings in this period.`,
      action: 'Promote these to other departments and include them in course lab sessions.',
    });
  }
  const peak = [...report.peakHours].sort((a, b) => b.load - a.load)[0];
  if (peak) {
    insights.push({
      title: `Peak demand at ${formatHour(peak.hour)}`,
      detail: `${peak.load} booking-hours fall in the ${formatHour(peak.hour)} hour across campus.`,
      action: 'Encourage off-peak slots (early morning or late afternoon) for flexible work.',
    });
  }
  const maintenance = report.items.filter((i) => i.capacityHours === 0);
  if (maintenance.length) {
    insights.push({
      title: 'Equipment under maintenance',
      detail: `${maintenance.map((i) => i.name).join(', ')} cannot be booked right now.`,
      action: 'Prioritise repairs or redirect affected students to partner labs.',
    });
  }
  return insights;
}
