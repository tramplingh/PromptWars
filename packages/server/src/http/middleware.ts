import type { Persona, Role } from '@lablink/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, z } from 'zod';
import { HttpError, badRequest, forbidden, unauthorized } from '../lib/errors.js';
import type { CatalogService } from '../services/catalogService.js';
import { SESSION_COOKIE, readCookie, type SessionSigner } from './session.js';

declare module 'express-serve-static-core' {
  interface Request {
    persona?: Persona;
  }
}

/** Wraps async handlers so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function attachPersona(signer: SessionSigner, catalog: CatalogService): RequestHandler {
  return (req, _res, next) => {
    const personaId = signer.verify(readCookie(req, SESSION_COOKIE));
    const persona = personaId ? catalog.findPersona(personaId) : undefined;
    if (persona) req.persona = persona;
    next();
  };
}

export function currentPersona(req: Request): Persona {
  if (!req.persona) throw unauthorized();
  return req.persona;
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const persona = req.persona;
    if (!persona) return next(unauthorized());
    if (!roles.includes(persona.role)) return next(forbidden());
    next();
  };
}

/**
 * CSRF defence in depth (alongside SameSite=Strict cookies): state-changing
 * requests must be JSON, which browsers cannot send cross-site without a CORS
 * pre-flight that this API never approves.
 */
export const requireJsonForMutations: RequestHandler = (req, _res, next) => {
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (mutating && !req.is('application/json')) {
    return next(
      new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Requests must be sent as application/json'),
    );
  }
  next();
};

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw badRequest('Please check the highlighted fields', z.flattenError(result.error));
  return result.data;
}

export function errorHandler(log: Pick<Console, 'error'>) {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof HttpError) {
      res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message, details: error.details } });
      return;
    }
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid request',
            details: z.flattenError(error),
          },
        });
      return;
    }
    // body-parser errors (malformed JSON, payload too large) carry a status.
    const status = (error as { status?: number }).status;
    if (status && status >= 400 && status < 500) {
      res
        .status(status)
        .json({ error: { code: 'BAD_REQUEST', message: 'Malformed request body' } });
      return;
    }
    log.error('[http] unhandled error', error);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
  };
}
