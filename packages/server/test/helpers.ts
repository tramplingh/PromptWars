import { workingDays } from '@lablink/shared';
import request from 'supertest';
import { AiService } from '../src/ai/aiService.js';
import type { LlmClient } from '../src/ai/llmClient.js';
import { createApp } from '../src/app.js';
import { departments, equipment, labs, personas } from '../src/data/catalog.js';
import { buildSeedBookings } from '../src/data/seedBookings.js';
import { SessionSigner } from '../src/http/session.js';
import { fixedClock } from '../src/lib/clock.js';
import { MemoryBookingRepository } from '../src/repositories/memoryBookingRepository.js';
import { ActivityService } from '../src/services/activityService.js';
import { ApprovalService } from '../src/services/approvalService.js';
import { BookingService } from '../src/services/bookingService.js';
import { CatalogService } from '../src/services/catalogService.js';
import type { Services } from '../src/services/container.js';
import { InsightsService } from '../src/services/insightsService.js';

/** Monday — keeps working-day arithmetic in tests predictable. */
export const TODAY = '2026-11-23';
export const NOW = '2026-11-23T04:30:00.000Z';
export const DAYS = workingDays(TODAY, 10);

export function buildTestServices(
  options: { llm?: LlmClient | null; seed?: boolean } = {},
): Services {
  const clock = fixedClock(NOW, TODAY);
  const catalog = new CatalogService({ departments, labs, equipment, personas });
  const repo = new MemoryBookingRepository(
    options.seed === false ? [] : buildSeedBookings(TODAY, NOW),
  );
  const bookings = new BookingService(repo, catalog, clock);
  return {
    catalog,
    bookings,
    approvals: new ApprovalService(repo, catalog, bookings, clock),
    insights: new InsightsService(repo, catalog, clock),
    activity: new ActivityService(repo, catalog, clock),
    ai: new AiService(options.llm ?? null, catalog, { warn: () => undefined }),
    signer: new SessionSigner('test-secret-that-is-at-least-32-characters-long'),
    clock,
    secureCookies: false,
  };
}

export function buildTestApp(options: Parameters<typeof buildTestServices>[0] = {}) {
  const services = buildTestServices(options);
  const app = createApp(services, { rateLimit: false, log: { error: () => undefined } });
  return { app, services };
}

/** Returns a supertest agent that holds a session cookie for the given persona. */
export async function loginAs(app: Parameters<typeof request.agent>[0], personaId: string) {
  const agent = request.agent(app);
  await agent.post('/api/session').send({ personaId }).expect(200);
  return agent;
}

export function bookingBody(
  overrides: {
    equipmentId?: string;
    date?: string;
    startHour?: number;
    endHour?: number;
    deadline?: string;
  } = {},
) {
  const date = overrides.date ?? DAYS[4]!;
  return {
    equipmentId: overrides.equipmentId ?? 'dso-keysight',
    slot: { date, startHour: overrides.startHour ?? 10, endHour: overrides.endHour ?? 12 },
    project: {
      title: 'Test project',
      summary: 'Characterising an amplifier stage for a course project.',
      deadline: overrides.deadline ?? '2026-12-20',
      requirements: ['oscilloscope'],
    },
  };
}
