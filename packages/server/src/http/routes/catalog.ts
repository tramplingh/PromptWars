import { availabilityQuerySchema } from '@lablink/shared';
import { Router } from 'express';
import type { Services } from '../../services/container.js';
import { asyncHandler, parse } from '../middleware.js';

export function catalogRoutes({ catalog, bookings }: Services): Router {
  const router = Router();

  router.get('/catalog', (_req, res) => {
    // Reference data changes rarely: let browsers reuse it briefly (ETag handles revalidation).
    res.set('Cache-Control', 'public, max-age=60').json(catalog.catalog());
  });

  router.get(
    '/equipment/status',
    asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store').json(await bookings.liveStatuses());
    }),
  );

  router.get(
    '/equipment/:id',
    asyncHandler(async (req, res) => {
      const { from, days } = parse(availabilityQuerySchema, req.query);
      const detail = await bookings.equipmentDetail(String(req.params.id), from, days);
      res.set('Cache-Control', 'no-store').json(detail);
    }),
  );

  return router;
}
