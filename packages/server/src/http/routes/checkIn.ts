import { checkInSchema } from '@lablink/shared';
import { Router } from 'express';
import type { Services } from '../../services/container.js';
import { asyncHandler, currentPersona, parse } from '../middleware.js';

export function checkInRoutes({ checkIns }: Services): Router {
  const router = Router();

  router.post(
    '/check-in',
    asyncHandler(async (req, res) => {
      const persona = currentPersona(req);
      const { equipmentId, code } = parse(checkInSchema, req.body);
      res.json(await checkIns.checkIn(persona, equipmentId, code));
    }),
  );

  router.get(
    '/equipment/:id/kiosk',
    asyncHandler(async (req, res) => {
      res
        .set('Cache-Control', 'no-store')
        .json(await checkIns.kiosk(currentPersona(req), String(req.params.id)));
    }),
  );

  return router;
}
