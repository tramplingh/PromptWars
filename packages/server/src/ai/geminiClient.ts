import { GoogleGenAI } from '@google/genai';
import { withFailover } from './failover.js';
import type { JsonGenerationRequest, LlmClient } from './llmClient.js';

export interface GeminiOptions {
  apiKey: string;
  model: string;
  /** Tried in order when the primary model is overloaded, out of quota, timing out or unavailable. */
  fallbackModels: readonly string[];
  timeoutMs: number;
}

/** Gemini implementation using structured JSON output, a hard time budget and model failover. */
export class GeminiClient implements LlmClient {
  private readonly ai: GoogleGenAI;
  private readonly models: string[];
  /** The model that answered most recently (reported by the AI status endpoint). */
  model: string;

  constructor(private readonly options: GeminiOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.models = [...new Set([options.model, ...options.fallbackModels])];
    this.model = options.model;
  }

  async generateJson<T>(request: JsonGenerationRequest<T>): Promise<T> {
    const budget = request.timeoutMs ?? this.options.timeoutMs;
    const { value, model } = await withFailover(this.models, budget, (model, timeoutMs) =>
      this.attempt(model, timeoutMs, request),
    );
    this.model = model;
    return value;
  }

  private async attempt<T>(model: string, timeoutMs: number, request: JsonGenerationRequest<T>) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: 'application/json',
          responseJsonSchema: request.jsonSchema,
          temperature: 0.2,
          maxOutputTokens: request.maxOutputTokens ?? 1024,
          // Latency matters more than deep reasoning for these short, grounded tasks.
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: controller.signal,
        },
      });
      const text = response.text;
      if (!text) throw new Error('Gemini returned an empty response');
      return request.validator.parse(JSON.parse(text));
    } finally {
      clearTimeout(timer);
    }
  }
}
