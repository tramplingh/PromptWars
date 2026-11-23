import compression from 'compression';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import { notFound } from './lib/errors.js';
import { attachPersona, errorHandler, requireJsonForMutations } from './http/middleware.js';
import { activityRoutes } from './http/routes/activity.js';
import { aiRoutes } from './http/routes/ai.js';
import { approvalRoutes } from './http/routes/approvals.js';
import { bookingRoutes } from './http/routes/bookings.js';
import { catalogRoutes } from './http/routes/catalog.js';
import { checkInRoutes } from './http/routes/checkIn.js';
import { insightsRoutes } from './http/routes/insights.js';
import { plannerRoutes } from './http/routes/planner.js';
import { sessionRoutes } from './http/routes/session.js';
import type { Services } from './services/container.js';

export interface AppOptions {
  /** Directory of the built web client to serve (local/production single-origin mode). */
  staticDir?: string;
  /** Disable rate limiting (tests). */
  rateLimit?: boolean;
  log?: Pick<Console, 'error'>;
}

const FIFTEEN_MINUTES = 15 * 60_000;

export function createApp(services: Services, options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  // Behind exactly one proxy hop on Vercel / Cloud Run; needed for correct client IPs in rate limiting.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  const api = express.Router();
  if (options.rateLimit !== false) {
    api.use(
      rateLimit({
        windowMs: FIFTEEN_MINUTES,
        limit: 600,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
      }),
    );
    // Gemini calls cost money and latency: tighter budget per client.
    api.use(
      ['/ai', '/planner/plan'],
      rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }),
    );
    api.use(
      '/conflicts/:id/explain',
      rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }),
    );
  }
  api.use(express.json({ limit: '16kb' }));
  api.use(requireJsonForMutations);
  api.use(attachPersona(services.signer, services.catalog));
  // Lazy no-show expiry: serverless has no background worker, so reads trigger the (throttled) sweep.
  api.use((req, _res, next) => {
    if (req.method !== 'GET') return next();
    services.checkIns.sweepIfDue().then(() => next(), next);
  });

  api.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok', ai: services.ai.status() });
  });
  api.use(sessionRoutes(services));
  api.use(catalogRoutes(services));
  api.use(bookingRoutes(services));
  api.use(approvalRoutes(services));
  api.use(insightsRoutes(services));
  api.use(activityRoutes(services));
  api.use(plannerRoutes(services));
  api.use(checkInRoutes(services));
  api.use(aiRoutes(services));
  api.use((_req, _res, next) => next(notFound('Endpoint')));

  app.use('/api', api);

  if (options.staticDir) {
    const staticDir = options.staticDir;
    // Hashed assets are immutable; index.html must always be revalidated.
    app.use(
      '/assets',
      express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y' }),
    );
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.set('Cache-Control', 'no-cache').sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use(errorHandler(options.log ?? console));
  return app;
}
