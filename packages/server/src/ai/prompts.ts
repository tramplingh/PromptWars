import {
  formatSlot,
  type AllocationPlan,
  type Equipment,
  type UtilisationReport,
} from '@lablink/shared';
import { UNTRUSTED_INPUT_RULE, wrapUserInput } from './llmClient.js';

/**
 * Prompt builders. Pure functions of their inputs, so prompts are easy to
 * review and test; user-supplied text always goes through `wrapUserInput`.
 */

export const SYSTEM_PROMPT = [
  'You are LabLink Assistant, helping university students and faculty share laboratory equipment fairly.',
  'Be concise, factual and encouraging. Only reference equipment ids that appear in the provided catalogue.',
  UNTRUSTED_INPUT_RULE,
].join(' ');

/** One JSON line per item: enough for matching, small enough to keep prompts cheap. */
export function compactCatalog(equipment: readonly Equipment[]): string {
  return equipment
    .map((e) =>
      JSON.stringify({
        id: e.id,
        name: e.name,
        category: e.category,
        dept: e.departmentId,
        caps: e.capabilities,
        status: e.status,
      }),
    )
    .join('\n');
}

export function searchPrompt(query: string, equipment: readonly Equipment[]): string {
  return [
    'Match the student need below to the most relevant equipment in this catalogue (JSON lines).',
    'Return up to 6 results ordered by relevance with a one-sentence reason each, explaining how the item helps.',
    'Return an empty list if nothing is relevant. Mention if an item is under maintenance.',
    `Catalogue:\n${compactCatalog(equipment)}`,
    `Student need:\n${wrapUserInput(query, 300)}`,
  ].join('\n\n');
}

export function draftPrompt(equipment: Equipment, idea: string, today: string): string {
  return [
    `Today is ${today}. A student wants to request the "${equipment.name}" (${equipment.description}).`,
    `Its capability tags are: ${equipment.capabilities.join(', ')}.`,
    'Turn their idea into a clear access request a faculty member can approve quickly:',
    '- title: short project title; summary: 2–3 sentences on goal, what will be done on the equipment and expected outcome;',
    `- requirements: the capability tags (from the list above) the work needs; suggestedHours: 1–${equipment.maxHoursPerBooking}.`,
    `Student idea:\n${wrapUserInput(idea)}`,
  ].join('\n');
}

export interface ExplainNames {
  student: (userId: string) => string;
  equipment: (equipmentId: string) => string;
}

export function explainPrompt(plan: AllocationPlan, names: ExplainNames): string {
  const facts = plan.decisions.map((d) => {
    const move = d.alternatives[0];
    return {
      bookingId: d.bookingId,
      student: names.student(d.userId),
      rank: d.rank,
      outcome: d.outcome,
      score: d.score.total,
      factors: d.score.breakdown,
      reasons: d.score.reasons,
      recommendedMove: move && `${names.equipment(move.equipmentId)}, ${formatSlot(move.slot)}`,
    };
  });
  return [
    `A fair-share engine resolved overlapping requests for the ${names.equipment(plan.conflict.equipmentId)}.`,
    'Weights: deadline urgency 40%, fairness of recent usage 25%, capability fit 20%, waiting time 15%.',
    'Explain the outcome to the approving faculty member in an overview (max 3 sentences), then write one short,',
    'empathetic message per student explaining their outcome and next step. Do NOT change any decision or invent facts.',
    `Decisions (JSON):\n${JSON.stringify(facts)}`,
  ].join('\n');
}

export function decomposePrompt(
  description: string,
  today: string,
  deadline: string,
  vocabulary: readonly string[],
): string {
  return [
    `Today is ${today}; the project deadline is ${deadline}.`,
    'Break the student project below into 2–6 concrete hands-on steps that each need campus lab equipment,',
    'in the order they must happen (e.g. mill PCB → debug with oscilloscope → laser-cut enclosure).',
    'For each step give: title (short), purpose (one sentence), requirements (1–2 capability tags chosen ONLY',
    'from the vocabulary, PRIMARY capability first — one machine must provide all of them), hours (realistic total',
    'hands-on hours, 1–12), dependsOn (0-based indexes of EARLIER steps).',
    `Capability vocabulary: ${vocabulary.join(', ')}`,
    `Student project:\n${wrapUserInput(description, 1500)}`,
  ].join('\n');
}

export function insightsPrompt(report: UtilisationReport): string {
  return [
    'You are advising the campus lab operations office. From the utilisation report below, give 3–4 specific,',
    'actionable insights to improve equipment utilisation and fairness across departments (idle items, bottlenecks,',
    'peak hours, maintenance). Reference equipment by name and include numbers.',
    `Report (JSON):\n${JSON.stringify(report)}`,
  ].join('\n');
}
