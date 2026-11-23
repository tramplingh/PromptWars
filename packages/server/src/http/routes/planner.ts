import { planBookingSchema, planRequestSchema } from '@lablink/shared';
import { Router } from 'express';
import type { Services } from '../../services/container.js';
import { asyncHandler, currentPersona, parse } from '../middleware.js';

export function plannerRoutes({ planner }: Services): Router {
  const router = Router();

  router.post(
    '/planner/plan',
    asyncHandler(async (req, res) => {
      const persona = currentPersona(req);
      res.json(await planner.plan(persona, parse(planRequestSchema, req.body)));
    }),
  );

  router.post(
    '/planner/book',
    asyncHandler(async (req, res) => {
      const persona = currentPersona(req);
      res.status(201).json(await planner.book(persona, parse(planBookingSchema, req.body)));
    }),
  );

  return router;
}
