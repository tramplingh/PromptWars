import { Router } from 'express';
import type { Services } from '../../services/container.js';
import { asyncHandler, requireRole } from '../middleware.js';

export function insightsRoutes({ insights, ai }: Services): Router {
  const router = Router();
  router.use('/insights', requireRole('faculty', 'admin'));

  router.get(
    '/insights/utilisation',
    asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store').json(await insights.utilisation());
    }),
  );

  router.get(
    '/insights/recommendations',
    asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store').json(await ai.insights(await insights.utilisation()));
    }),
  );

  return router;
}
