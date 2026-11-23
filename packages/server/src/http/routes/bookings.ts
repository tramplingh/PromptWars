import { createBookingSchema, type CreateBookingResponse } from '@lablink/shared';
import { Router } from 'express';
import type { Services } from '../../services/container.js';
import { asyncHandler, currentPersona, parse } from '../middleware.js';

export function bookingRoutes({ bookings }: Services): Router {
  const router = Router();

  router.get(
    '/bookings/mine',
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store').json(await bookings.listForUser(currentPersona(req).id));
    }),
  );

  router.post(
    '/bookings',
    asyncHandler(async (req, res) => {
      const persona = currentPersona(req);
      const input = parse(createBookingSchema, req.body);
      const result: CreateBookingResponse = await bookings.create(persona, input);
      res.status(201).json(result);
    }),
  );

  router.post(
    '/bookings/:id/cancel',
    asyncHandler(async (req, res) => {
      res.json(await bookings.cancel(currentPersona(req), String(req.params.id)));
    }),
  );

  return router;
}
