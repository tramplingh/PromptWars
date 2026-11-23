import { MAX_PLAN_STEPS, capabilityTagSchema, type PlanStepInput } from '@lablink/shared';
import type { RawPlanStep } from './outputSchemas.js';

/** A planner step as proposed by Gemini or the rules, with a human-readable purpose. */
export type ProposedStep = PlanStepInput & { purpose: string };

/** Normalises tags and keeps only those in the allowed vocabulary (deduplicated, order kept). */
export function allowedTags(tags: readonly string[], vocabulary: ReadonlySet<string>): string[] {
  const kept = tags
    .map((tag) => capabilityTagSchema.safeParse(tag))
    .flatMap((result) => (result.success && vocabulary.has(result.data) ? [result.data] : []));
  return [...new Set(kept)];
}

/**
 * Makes model-proposed steps safe for the scheduler: keeps only known
 * capability tags, drops steps left with none, clamps hours, and remaps
 * dependencies so they only point to earlier, surviving steps.
 */
export function sanitiseSteps(
  raw: readonly RawPlanStep[],
  vocabulary: ReadonlySet<string>,
): ProposedStep[] {
  const kept = raw
    .map((step, index) => ({
      index,
      step,
      requirements: allowedTags(step.requirements, vocabulary),
    }))
    .filter((k) => k.requirements.length > 0)
    .slice(0, MAX_PLAN_STEPS);
  const newId = new Map(kept.map((k, i) => [k.index, `s${i + 1}`]));

  return kept.map(({ index, step, requirements }, i) => ({
    id: `s${i + 1}`,
    title: step.title,
    purpose: step.purpose,
    requirements,
    hours: Math.min(12, Math.max(1, Math.round(step.hours))),
    dependsOn: step.dependsOn.flatMap((d) => {
      const id = d < index ? newId.get(d) : undefined;
      return id ? [id] : [];
    }),
  }));
}
