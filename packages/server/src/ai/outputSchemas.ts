import { z } from 'zod';

/**
 * Contracts for structured Gemini output. Each feature has a JSON Schema (sent
 * to the model for constrained decoding) and a Zod validator (the model's
 * answer is untrusted until it passes).
 */

const str = { type: 'string' } as const;
const strings = { type: 'array', items: str } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
});

export const searchContract = {
  jsonSchema: obj({ results: { type: 'array', items: obj({ equipmentId: str, reason: str }) } }),
  validator: z.object({
    results: z
      .array(z.object({ equipmentId: z.string(), reason: z.string().min(1).max(300) }))
      .max(8),
  }),
};

export const draftContract = {
  jsonSchema: obj({
    title: str,
    summary: str,
    requirements: strings,
    suggestedHours: { type: 'integer' },
  }),
  validator: z.object({
    title: z.string().min(3).max(120),
    summary: z.string().min(20).max(1000),
    requirements: z.array(z.string()).max(8),
    suggestedHours: z.number().int().min(1).max(12),
  }),
};

export const explainContract = {
  jsonSchema: obj({
    overview: str,
    perStudent: { type: 'array', items: obj({ bookingId: str, message: str }) },
  }),
  validator: z.object({
    overview: z.string().min(1).max(1200),
    perStudent: z.array(z.object({ bookingId: z.string(), message: z.string().min(1).max(500) })),
  }),
};

export const insightsContract = {
  jsonSchema: obj({
    insights: { type: 'array', items: obj({ title: str, detail: str, action: str }) },
  }),
  validator: z.object({
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
  }),
};

const rawStep = z.object({
  title: z.string().min(2).max(80),
  purpose: z.string().min(2).max(200),
  requirements: z.array(z.string()).max(6),
  hours: z.number().min(0.5).max(24),
  dependsOn: z.array(z.number().int()).max(6),
});
export type RawPlanStep = z.infer<typeof rawStep>;

export const decomposeContract = {
  jsonSchema: obj({
    title: str,
    summary: str,
    steps: {
      type: 'array',
      items: obj({
        title: str,
        purpose: str,
        requirements: strings,
        hours: { type: 'number' },
        dependsOn: { type: 'array', items: { type: 'integer' } },
      }),
    },
  }),
  validator: z.object({
    title: z.string().min(3).max(120),
    summary: z.string().min(20).max(1000),
    steps: z.array(rawStep).min(1).max(8),
  }),
};
