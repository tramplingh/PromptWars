import type { AiService } from '../ai/aiService.js';
import type { ActivityService } from './activityService.js';
import type { SessionSigner } from '../http/session.js';
import type { Clock } from '../lib/clock.js';
import type { ApprovalService } from './approvalService.js';
import type { BookingService } from './bookingService.js';
import type { CatalogService } from './catalogService.js';
import type { InsightsService } from './insightsService.js';

/** Everything the HTTP layer needs, wired once at start-up (see `bootstrap.ts`). */
export interface Services {
  catalog: CatalogService;
  bookings: BookingService;
  approvals: ApprovalService;
  insights: InsightsService;
  activity: ActivityService;
  ai: AiService;
  signer: SessionSigner;
  clock: Clock;
  secureCookies: boolean;
}
