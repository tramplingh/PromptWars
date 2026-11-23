import { conflictIdSchema, decisionSchema } from '@lablink/shared';
import { Router } from 'express';
import type { Services } from '../../services/container.js';
import { asyncHandler, currentPersona, parse, requireRole } from '../middleware.js';

export function approvalRoutes({ approvals, ai }: Services): Router {
  const router = Router();
  router.use(['/approvals', '/conflicts'], requireRole('faculty', 'admin'));

  router.get(
    '/approvals',
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store').json(await approvals.queue(currentPersona(req)));
    }),
  );

  router.post(
    '/approvals/:id/decision',
    asyncHandler(async (req, res) => {
      const input = parse(decisionSchema, req.body);
      res.json(await approvals.decide(currentPersona(req), String(req.params.id), input));
    }),
  );

  router.post(
    '/conflicts/:conflictId/explain',
    asyncHandler(async (req, res) => {
      const { conflictId } = parse(conflictIdSchema, req.params);
      const plan = await approvals.plan(currentPersona(req), conflictId);
      res.json(await ai.explainConflict(plan));
    }),
  );

  router.post(
    '/conflicts/:conflictId/apply',
    asyncHandler(async (req, res) => {
      const { conflictId } = parse(conflictIdSchema, req.params);
      res.json({ updated: await approvals.applyPlan(currentPersona(req), conflictId) });
    }),
  );

  return router;
}
