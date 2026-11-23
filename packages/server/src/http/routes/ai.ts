import { aiDraftSchema, aiSearchSchema } from '@lablink/shared';
import { Router } from 'express';
import type { Services } from '../../services/container.js';
import { asyncHandler, currentPersona, parse } from '../middleware.js';

export function aiRoutes({ ai, catalog, clock }: Services): Router {
  const router = Router();

  router.get('/ai/status', (_req, res) => {
    res.json({ enabled: ai.enabled });
  });

  router.post(
    '/ai/search',
    asyncHandler(async (req, res) => {
      const { query } = parse(aiSearchSchema, req.body);
      res.json(await ai.search(query));
    }),
  );

  router.post(
    '/ai/draft',
    asyncHandler(async (req, res) => {
      currentPersona(req);
      const { equipmentId, idea } = parse(aiDraftSchema, req.body);
      res.json(await ai.draftRequest(catalog.requireEquipment(equipmentId), idea, clock.today()));
    }),
  );

  return router;
}
