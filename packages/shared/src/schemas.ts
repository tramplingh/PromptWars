import { z } from 'zod';
import { isIsoDate } from './time.js';

/**
 * Request validation schemas. The server uses them as the single trust
 * boundary for all input; the web client reuses them for instant form feedback.
 */

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/i, 'Invalid identifier');

export const isoDateSchema = z.string().refine(isIsoDate, 'Expected a valid date (YYYY-MM-DD)');

export const capabilityTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, digits and hyphens');

export const timeSlotSchema = z
  .object({
    date: isoDateSchema,
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
  })
  .refine((s) => s.endHour > s.startHour, {
    message: 'End must be after start',
    path: ['endHour'],
  });

export const projectSchema = z.object({
  title: z.string().trim().min(3, 'Give your project a title').max(120),
  summary: z.string().trim().min(20, 'Describe the project in at least 20 characters').max(1000),
  deadline: isoDateSchema,
  requirements: z.array(capabilityTagSchema).max(10).default([]),
});

export const sessionRequestSchema = z.object({ personaId: id });

export const createBookingSchema = z.object({
  equipmentId: id,
  slot: timeSlotSchema,
  project: projectSchema,
});

export const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).default(''),
});

export const availabilityQuerySchema = z.object({
  from: isoDateSchema.optional(),
  days: z.coerce.number().int().min(1).max(10).default(5),
});

export const aiSearchSchema = z.object({
  query: z.string().trim().min(3, 'Describe what you need in a few words').max(300),
});

export const aiDraftSchema = z.object({
  equipmentId: id,
  idea: z.string().trim().min(10, 'Tell us a little more about your idea').max(1000),
});

export const conflictIdSchema = z.object({
  conflictId: z
    .string()
    .max(128)
    .regex(/^[a-z0-9-]+_\d{4}-\d{2}-\d{2}_\d{1,2}-\d{1,2}$/i, 'Invalid conflict id'),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;

export const planRequestSchema = z.object({
  description: z
    .string()
    .trim()
    .min(20, 'Describe your project in at least 20 characters')
    .max(1500),
  deadline: isoDateSchema,
});

export const planBookingSchema = z.object({
  project: z.object({
    title: projectSchema.shape.title,
    summary: projectSchema.shape.summary,
    deadline: isoDateSchema,
  }),
  items: z
    .array(
      z.object({
        equipmentId: id,
        slot: timeSlotSchema,
        requirements: z.array(capabilityTagSchema).max(10),
      }),
    )
    .min(1)
    .max(20),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
export type PlanBookingInput = z.infer<typeof planBookingSchema>;

export const checkInSchema = z.object({
  equipmentId: id,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Enter the 6-character code shown on the lab display'),
});
