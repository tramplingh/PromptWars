import {
  MAX_PLAN_STEPS,
  capabilityTagSchema,
  formatSlot,
  type AiDraftResponse,
  type AiSearchResponse,
  type AllocationPlan,
  type ConflictExplanation,
  type Equipment,
  type InsightsResponse,
  type UtilisationReport,
} from '@lablink/shared';
import { z } from 'zod';
import { TtlCache } from '../lib/cache.js';
import type { CatalogService } from '../services/catalogService.js';
import {
  decomposeFallback,
  draftFallback,
  explainFallback,
  insightsFallback,
  keywordSearch,
  type Decomposition,
} from './fallbacks.js';
import { UNTRUSTED_INPUT_RULE, wrapUserInput, type LlmClient } from './llmClient.js';

const SYSTEM = [
  'You are LabLink Assistant, helping university students and faculty share laboratory equipment fairly.',
  'Be concise, factual and encouraging. Only reference equipment ids that appear in the provided catalogue.',
  UNTRUSTED_INPUT_RULE,
].join(' ');

const searchOutput = z.object({
  results: z
    .array(z.object({ equipmentId: z.string(), reason: z.string().min(1).max(300) }))
    .max(8),
});
const draftOutput = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(20).max(1000),
  requirements: z.array(z.string()).max(8),
  suggestedHours: z.number().int().min(1).max(12),
});
const explainOutput = z.object({
  overview: z.string().min(1).max(1200),
  perStudent: z.array(z.object({ bookingId: z.string(), message: z.string().min(1).max(500) })),
});
const insightsOutput = z.object({
  insights: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        detail: z.string().min(1).max(300),
        action: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(4),
});

const decomposeOutput = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(20).max(1000),
  steps: z
    .array(
      z.object({
        title: z.string().min(2).max(80),
        purpose: z.string().min(2).max(200),
        requirements: z.array(z.string()).max(6),
        hours: z.number().min(0.5).max(24),
        dependsOn: z.array(z.number().int()).max(6),
      }),
    )
    .min(1)
    .max(8),
});

const str = { type: 'string' } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
});

/**
 * GenAI features. Every method is grounded in LabLink data, validated against a
 * schema, cached, and degrades gracefully to a deterministic fallback.
 */
export interface AiStatus {
  configured: boolean;
  model: string | null;
  lastSuccessAt: string | null;
  lastFailure: { at: string; reason: string } | null;
}

export class AiService {
  private readonly cache = new TtlCache<unknown>();
  private lastSuccessAt: string | null = null;
  private lastFailure: AiStatus['lastFailure'] = null;

  constructor(
    private readonly llm: LlmClient | null,
    private readonly catalog: CatalogService,
    private readonly log: Pick<Console, 'warn'> = console,
  ) {}

  get enabled(): boolean {
    return this.llm !== null;
  }

  /** Operator visibility: is Gemini configured, and is it actually answering? */
  status(): AiStatus {
    return {
      configured: this.enabled,
      model: this.llm?.model ?? null,
      lastSuccessAt: this.lastSuccessAt,
      lastFailure: this.lastFailure,
    };
  }

  async search(query: string): Promise<AiSearchResponse> {
    const fallback = (): AiSearchResponse => ({
      source: 'fallback',
      results: keywordSearch(query, this.catalog.equipment),
    });
    return this.cached(['search', query.toLowerCase()], fallback, async (llm) => {
      const out = await llm.generateJson({
        system: SYSTEM,
        prompt: [
          'Match the student need below to the most relevant equipment in this catalogue (JSON lines).',
          'Return up to 6 results ordered by relevance with a one-sentence reason each, explaining how the item helps.',
          'Return an empty list if nothing is relevant. Mention if an item is under maintenance.',
          `Catalogue:\n${this.compactCatalog()}`,
          `Student need:\n${wrapUserInput(query, 300)}`,
        ].join('\n\n'),
        jsonSchema: obj({
          results: { type: 'array', items: obj({ equipmentId: str, reason: str }) },
        }),
        validator: searchOutput,
      });
      const results = out.results
        .filter((r) => this.catalog.findEquipment(r.equipmentId))
        .slice(0, 6);
      return { source: 'gemini', results };
    });
  }

  async draftRequest(equipment: Equipment, idea: string, today: string): Promise<AiDraftResponse> {
    const fallback = () => draftFallback(equipment, idea);
    return this.cached(['draft', equipment.id, idea], fallback, async (llm) => {
      const out = await llm.generateJson({
        system: SYSTEM,
        prompt: [
          `Today is ${today}. A student wants to request the "${equipment.name}" (${equipment.description}).`,
          `Its capability tags are: ${equipment.capabilities.join(', ')}.`,
          'Turn their idea into a clear access request a faculty member can approve quickly:',
          '- title: short project title; summary: 2–3 sentences on goal, what will be done on the equipment and expected outcome;',
          `- requirements: the capability tags (from the list above) the work needs; suggestedHours: 1–${equipment.maxHoursPerBooking}.`,
          `Student idea:\n${wrapUserInput(idea)}`,
        ].join('\n'),
        jsonSchema: obj({
          title: str,
          summary: str,
          requirements: { type: 'array', items: str },
          suggestedHours: { type: 'integer' },
        }),
        validator: draftOutput,
      });
      const allowed = new Set(equipment.capabilities);
      const requirements = out.requirements
        .map((r) => capabilityTagSchema.safeParse(r))
        .flatMap((r) => (r.success && allowed.has(r.data) ? [r.data] : []));
      return {
        source: 'gemini',
        title: out.title,
        summary: out.summary,
        requirements: [...new Set(requirements)],
        suggestedHours: Math.min(Math.max(1, out.suggestedHours), equipment.maxHoursPerBooking),
      };
    });
  }

  async explainConflict(plan: AllocationPlan): Promise<ConflictExplanation> {
    const names = {
      student: (id: string) => this.catalog.personaName(id),
      equipment: (id: string) => this.catalog.findEquipment(id)?.name ?? id,
    };
    const fallback = () => explainFallback(plan, names);
    return this.cached(['explain', plan], fallback, async (llm) => {
      const facts = plan.decisions.map((d) => ({
        bookingId: d.bookingId,
        student: names.student(d.userId),
        rank: d.rank,
        outcome: d.outcome,
        score: d.score.total,
        factors: d.score.breakdown,
        reasons: d.score.reasons,
        recommendedMove:
          d.alternatives[0] &&
          `${names.equipment(d.alternatives[0].equipmentId)}, ${formatSlot(d.alternatives[0].slot)}`,
      }));
      const out = await llm.generateJson({
        system: SYSTEM,
        prompt: [
          `A fair-share engine resolved overlapping requests for the ${names.equipment(plan.conflict.equipmentId)}.`,
          'Weights: deadline urgency 40%, fairness of recent usage 25%, capability fit 20%, waiting time 15%.',
          'Explain the outcome to the approving faculty member in an overview (max 3 sentences), then write one short,',
          'empathetic message per student explaining their outcome and next step. Do NOT change any decision or invent facts.',
          `Decisions (JSON):\n${JSON.stringify(facts)}`,
        ].join('\n'),
        jsonSchema: obj({
          overview: str,
          perStudent: { type: 'array', items: obj({ bookingId: str, message: str }) },
        }),
        validator: explainOutput,
      });
      const known = new Set(plan.decisions.map((d) => d.bookingId));
      return {
        source: 'gemini',
        overview: out.overview,
        perStudent: out.perStudent.filter((p) => known.has(p.bookingId)),
      };
    });
  }

  /**
   * Breaks a free-text project into ordered steps the scheduler can place.
   * The model only proposes steps; capability tags are whitelisted against the
   * catalogue, hours are clamped and dependencies may only point backwards.
   */
  async decomposeProject(
    description: string,
    today: string,
    deadline: string,
  ): Promise<Decomposition> {
    const vocabulary = [...new Set(this.catalog.equipment.flatMap((e) => e.capabilities))].sort();
    const fallback = () => decomposeFallback(description, this.catalog.equipment);
    const result = await this.cached(
      ['decompose', description, deadline],
      fallback,
      async (llm) => {
        const out = await llm.generateJson({
          system: SYSTEM,
          prompt: [
            `Today is ${today}; the project deadline is ${deadline}.`,
            'Break the student project below into 2–6 concrete hands-on steps that each need campus lab equipment,',
            'in the order they must happen (e.g. mill PCB → debug with oscilloscope → laser-cut enclosure).',
            'For each step give: title (short), purpose (one sentence), requirements (1–2 capability tags chosen ONLY',
            'from the vocabulary, PRIMARY capability first — one machine must provide all of them), hours (realistic total',
            'hands-on hours, 1–12), dependsOn (0-based indexes of EARLIER steps).',
            `Capability vocabulary: ${vocabulary.join(', ')}`,
            `Student project:\n${wrapUserInput(description, 1500)}`,
          ].join('\n'),
          jsonSchema: obj({
            title: str,
            summary: str,
            steps: {
              type: 'array',
              items: obj({
                title: str,
                purpose: str,
                requirements: { type: 'array', items: str },
                hours: { type: 'number' },
                dependsOn: { type: 'array', items: { type: 'integer' } },
              }),
            },
          }),
          validator: decomposeOutput,
          maxOutputTokens: 1500,
          // Longer structured answer than the other features: allow extra time.
          timeoutMs: 20_000,
        });
        return {
          source: 'gemini' as const,
          title: out.title,
          summary: out.summary,
          steps: sanitiseSteps(out.steps, new Set(vocabulary)),
        };
      },
    );
    // A model answer with no usable steps is no better than the rules.
    return result.steps.length > 0 ? result : fallback();
  }

  async insights(report: UtilisationReport): Promise<InsightsResponse> {
    const fallback = (): InsightsResponse => ({
      source: 'fallback',
      insights: insightsFallback(report),
    });
    return this.cached(['insights', report], fallback, async (llm) => {
      const out = await llm.generateJson({
        system: SYSTEM,
        prompt: [
          'You are advising the campus lab operations office. From the utilisation report below, give 3–4 specific,',
          'actionable insights to improve equipment utilisation and fairness across departments (idle items, bottlenecks,',
          'peak hours, maintenance). Reference equipment by name and include numbers.',
          `Report (JSON):\n${JSON.stringify(report)}`,
        ].join('\n'),
        jsonSchema: obj({
          insights: { type: 'array', items: obj({ title: str, detail: str, action: str }) },
        }),
        validator: insightsOutput,
        maxOutputTokens: 1200,
      });
      return { source: 'gemini', insights: out.insights };
    });
  }

  private async cached<T>(
    keyParts: unknown[],
    fallback: () => T,
    call: (llm: LlmClient) => Promise<T>,
  ): Promise<T> {
    if (!this.llm) return fallback();
    const key = TtlCache.key(...keyParts);
    const hit = this.cache.get(key) as T | undefined;
    if (hit) return hit;
    try {
      const value = await call(this.llm);
      this.cache.set(key, value);
      this.lastSuccessAt = new Date().toISOString();
      return value;
    } catch (error) {
      // Provider errors carry status codes and reasons, never our prompts or user text.
      const reason = (
        error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error'
      ).slice(0, 200);
      this.lastFailure = { at: new Date().toISOString(), reason };
      this.log.warn(`[ai] ${String(keyParts[0])} fell back to rules — ${reason}`);
      return fallback();
    }
  }

  private compactCatalog(): string {
    return this.catalog.equipment
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
}

/**
 * Makes model-proposed steps safe for the scheduler: keeps only known
 * capability tags, drops steps left with none, clamps hours, and remaps
 * dependencies so they only point to earlier, surviving steps.
 */
export function sanitiseSteps(
  raw: z.infer<typeof decomposeOutput>['steps'],
  vocabulary: ReadonlySet<string>,
): Decomposition['steps'] {
  const kept: { index: number; step: (typeof raw)[number]; requirements: string[] }[] = [];
  raw.forEach((step, index) => {
    const requirements = [
      ...new Set(
        step.requirements
          .map((r) => capabilityTagSchema.safeParse(r))
          .flatMap((r) => (r.success && vocabulary.has(r.data) ? [r.data] : [])),
      ),
    ];
    if (requirements.length > 0) kept.push({ index, step, requirements });
  });
  const newId = new Map(kept.slice(0, MAX_PLAN_STEPS).map((k, i) => [k.index, `s${i + 1}`]));
  return kept.slice(0, MAX_PLAN_STEPS).map(({ index, step, requirements }) => ({
    id: newId.get(index)!,
    title: step.title,
    purpose: step.purpose,
    requirements,
    hours: Math.min(12, Math.max(1, Math.round(step.hours))),
    dependsOn: step.dependsOn.filter((d) => d < index && newId.has(d)).map((d) => newId.get(d)!),
  }));
}
