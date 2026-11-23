import { Router } from 'express';
import type { Services } from '../../services/container.js';
import { asyncHandler, currentPersona } from '../middleware.js';

export function activityRoutes({ activity }: Services): Router {
  const router = Router();

  router.get(
    '/activity',
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store').json(await activity.feed(currentPersona(req)));
    }),
  );

  return router;
}
