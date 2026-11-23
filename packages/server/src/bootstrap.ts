import { AiService } from './ai/aiService.js';
import { GeminiClient } from './ai/geminiClient.js';
import type { AppConfig } from './config.js';
import { departments, equipment, labs, personas } from './data/catalog.js';
import { buildSeedBookings } from './data/seedBookings.js';
import { SessionSigner } from './http/session.js';
import { systemClock, type Clock } from './lib/clock.js';
import type { BookingRepository } from './repositories/bookingRepository.js';
import { MemoryBookingRepository } from './repositories/memoryBookingRepository.js';
import { ActivityService } from './services/activityService.js';
import { ApprovalService } from './services/approvalService.js';
import { BookingService } from './services/bookingService.js';
import { CatalogService } from './services/catalogService.js';
import { CheckInService } from './services/checkInService.js';
import type { Services } from './services/container.js';
import { InsightsService } from './services/insightsService.js';
import { PlannerService } from './services/plannerService.js';

/** Composition root: builds the object graph from configuration. */
export async function buildServices(
  config: AppConfig,
  clock: Clock = systemClock(config.campusTimeZone, config.clockOffsetHours * 3_600_000),
): Promise<Services> {
  const catalog = new CatalogService({ departments, labs, equipment, personas });
  const seed = buildSeedBookings(clock.today(), clock.now(), clock.hour());
  const repo = await createRepository(config, seed);

  const llm = config.gemini.apiKey
    ? new GeminiClient({
        apiKey: config.gemini.apiKey,
        model: config.gemini.model,
        fallbackModels: config.gemini.fallbackModels,
        timeoutMs: config.gemini.timeoutMs,
      })
    : null;

  const bookings = new BookingService(repo, catalog, clock);
  const ai = new AiService(llm, catalog);
  return {
    catalog,
    bookings,
    approvals: new ApprovalService(repo, catalog, bookings, clock),
    insights: new InsightsService(repo, catalog, clock),
    activity: new ActivityService(repo, catalog, clock),
    planner: new PlannerService(repo, catalog, bookings, ai, clock),
    checkIns: new CheckInService(repo, catalog, bookings, clock, config.sessionSecret),
    ai,
    signer: new SessionSigner(config.sessionSecret),
    clock,
    secureCookies: config.env === 'production',
  };
}

async function createRepository(
  config: AppConfig,
  seed: ReturnType<typeof buildSeedBookings>,
): Promise<BookingRepository> {
  if (config.dataBackend === 'memory') return new MemoryBookingRepository(seed);

  // Loaded lazily so local/memory runs never pay firebase-admin's start-up cost.
  const [
    { initializeApp, getApps, cert, applicationDefault },
    { getFirestore },
    { FirestoreBookingRepository },
  ] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
    import('./repositories/firestoreBookingRepository.js'),
  ]);
  const credential = config.firestore.serviceAccountBase64
    ? cert(
        JSON.parse(Buffer.from(config.firestore.serviceAccountBase64, 'base64').toString('utf8')),
      )
    : applicationDefault();
  const app = getApps()[0] ?? initializeApp({ credential, projectId: config.firestore.projectId });
  const repo = new FirestoreBookingRepository(getFirestore(app));
  await repo.seedIfEmpty(seed);
  return repo;
}
