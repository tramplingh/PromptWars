import { GoogleGenAI } from '@google/genai';
import type { JsonGenerationRequest, LlmClient } from './llmClient.js';

export interface GeminiOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/** Gemini implementation using structured JSON output and a hard timeout. */
export class GeminiClient implements LlmClient {
  private readonly ai: GoogleGenAI;

  constructor(private readonly options: GeminiOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
  }

  async generateJson<T>(request: JsonGenerationRequest<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await this.ai.models.generateContent({
        model: this.options.model,
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
