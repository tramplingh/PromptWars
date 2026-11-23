import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'lablink_session';
const MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * Stateless signed sessions: `<personaId>.<issuedAt>.<hmac>`. Being stateless
 * they work across serverless instances; the HMAC prevents a client from
 * forging another persona or extending the expiry.
 */
export class SessionSigner {
  constructor(
    private readonly secret: string,
    private readonly nowSeconds: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  sign(personaId: string): string {
    const payload = `${personaId}.${this.nowSeconds()}`;
    return `${payload}.${this.mac(payload)}`;
  }

  /** Returns the persona id for a valid, unexpired token; otherwise null. */
  verify(token: string | undefined): string | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [personaId, issuedAt, mac] = parts as [string, string, string];
    const expected = Buffer.from(this.mac(`${personaId}.${issuedAt}`));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const age = this.nowSeconds() - Number(issuedAt);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_SECONDS) return null;
    return personaId;
  }

  private mac(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function setSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    path: '/',
    maxAge: MAX_AGE_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure, path: '/' });
}
