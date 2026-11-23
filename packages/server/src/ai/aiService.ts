import type {
  AiDraftResponse,
  AiSearchResponse,
  AllocationPlan,
  ConflictExplanation,
  Equipment,
  InsightsResponse,
  UtilisationReport,
} from '@lablink/shared';
import { TtlCache } from '../lib/cache.js';
import type { CatalogService } from '../services/catalogService.js';
import { decomposeFallback, type Decomposition } from './fallbackPlanner.js';
import { draftFallback, explainFallback, insightsFallback, keywordSearch } from './fallbacks.js';
import type { LlmClient } from './llmClient.js';
import {
  decomposeContract,
  draftContract,
  explainContract,
  insightsContract,
  searchContract,
} from './outputSchemas.js';
import {
  SYSTEM_PROMPT,
  decomposePrompt,
  draftPrompt,
  explainPrompt,
  insightsPrompt,
  searchPrompt,
  type ExplainNames,
} from './prompts.js';
import { allowedTags, sanitiseSteps } from './sanitise.js';

export interface AiStatus {
  configured: boolean;
  model: string | null;
  lastSuccessAt: string | null;
  lastFailure: { at: string; reason: string } | null;
}

/** Longer structured answers (project breakdowns) get more time than quick lookups. */
const DECOMPOSE_TIMEOUT_MS = 20_000;
const MAX_SEARCH_RESULTS = 6;

/**
 * GenAI features. Every method is grounded in LabLink data, validated against a
 * schema, cached, and degrades gracefully to a deterministic fallback. Gemini
 * never makes allocation decisions: it searches, drafts, explains and proposes.
 */
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
        system: SYSTEM_PROMPT,
        prompt: searchPrompt(query, this.catalog.equipment),
        ...searchContract,
      });
      // Only ids that exist in the catalogue survive (no hallucinated equipment).
      const results = out.results
        .filter((r) => this.catalog.findEquipment(r.equipmentId))
        .slice(0, MAX_SEARCH_RESULTS);
      return { source: 'gemini', results };
    });
  }

  async draftRequest(equipment: Equipment, idea: string, today: string): Promise<AiDraftResponse> {
    const fallback = () => draftFallback(equipment, idea);
    return this.cached(['draft', equipment.id, idea], fallback, async (llm) => {
      const out = await llm.generateJson({
        system: SYSTEM_PROMPT,
        prompt: draftPrompt(equipment, idea, today),
        ...draftContract,
      });
      return {
        source: 'gemini',
        title: out.title,
        summary: out.summary,
        requirements: allowedTags(out.requirements, new Set(equipment.capabilities)),
        suggestedHours: Math.min(Math.max(1, out.suggestedHours), equipment.maxHoursPerBooking),
      };
    });
  }

  async explainConflict(plan: AllocationPlan): Promise<ConflictExplanation> {
    const names: ExplainNames = {
      student: (id) => this.catalog.personaName(id),
      equipment: (id) => this.catalog.findEquipment(id)?.name ?? id,
    };
    const fallback = () => explainFallback(plan, names);
    return this.cached(['explain', plan], fallback, async (llm) => {
      const out = await llm.generateJson({
        system: SYSTEM_PROMPT,
        prompt: explainPrompt(plan, names),
        ...explainContract,
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
   * The model only proposes steps; they are sanitised before scheduling.
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
          system: SYSTEM_PROMPT,
          prompt: decomposePrompt(description, today, deadline, vocabulary),
          ...decomposeContract,
          maxOutputTokens: 1500,
          timeoutMs: DECOMPOSE_TIMEOUT_MS,
        });
        const steps = sanitiseSteps(out.steps, new Set(vocabulary));
        return { source: 'gemini' as const, title: out.title, summary: out.summary, steps };
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
        system: SYSTEM_PROMPT,
        prompt: insightsPrompt(report),
        ...insightsContract,
        maxOutputTokens: 1200,
      });
      return { source: 'gemini', insights: out.insights };
    });
  }

  /** Cache → Gemini → fallback, recording health for `/api/health`. */
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
}
