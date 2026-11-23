import { sessionRequestSchema, type SessionInfo } from '@lablink/shared';
import { Router } from 'express';
import { notFound } from '../../lib/errors.js';
import type { Services } from '../../services/container.js';
import { parse } from '../middleware.js';
import { clearSessionCookie, setSessionCookie } from '../session.js';

/** Role switcher: choosing a demo persona issues a signed session cookie (no login page). */
export function sessionRoutes({ catalog, signer, secureCookies }: Services): Router {
  const router = Router();

  router.get('/personas', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json(catalog.personas);
  });

  router.get('/session', (req, res) => {
    const body: SessionInfo = { persona: req.persona ?? null };
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.post('/session', (req, res) => {
    const { personaId } = parse(sessionRequestSchema, req.body);
    const persona = catalog.findPersona(personaId);
    if (!persona) throw notFound('Profile');
    setSessionCookie(res, signer.sign(persona.id), secureCookies);
    const body: SessionInfo = { persona };
    res.json(body);
  });

  router.delete('/session', (_req, res) => {
    clearSessionCookie(res, secureCookies);
    const body: SessionInfo = { persona: null };
    res.json(body);
  });

  return router;
}
