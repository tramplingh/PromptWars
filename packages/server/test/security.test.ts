import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { SessionSigner } from '../src/http/session.js';
import { buildTestApp, buildTestServices } from './helpers.js';

describe('session signing', () => {
  const signer = new SessionSigner('a-secret-that-is-definitely-32-chars-long', () => 1_000);

  it('round-trips a valid token', () => {
    expect(signer.verify(signer.sign('s-priya'))).toBe('s-priya');
  });

  it('rejects tampered, foreign and malformed tokens', () => {
    const token = signer.sign('s-priya');
    expect(signer.verify(token.replace('s-priya', 'f-rao'))).toBeNull();
    expect(
      signer.verify(new SessionSigner('another-secret-that-is-32-chars-long!').sign('s-priya')),
    ).toBeNull();
    expect(signer.verify('garbage')).toBeNull();
    expect(signer.verify(undefined)).toBeNull();
  });

  it('expires tokens after eight hours', () => {
    const token = signer.sign('s-priya');
    const later = new SessionSigner(
      'a-secret-that-is-definitely-32-chars-long',
      () => 1_000 + 8 * 3600 + 1,
    );
    expect(later.verify(token)).toBeNull();
  });
});

describe('HTTP hardening', () => {
  it('sets a strict CSP and hides the framework', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/health').expect(200);
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('issues HttpOnly, SameSite=Strict session cookies', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/session').send({ personaId: 's-priya' }).expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it('rejects unknown personas and invalid ids', async () => {
    const { app } = buildTestApp();
    await request(app).post('/api/session').send({ personaId: 'nobody' }).expect(404);
    await request(app).post('/api/session').send({ personaId: '../../etc' }).expect(400);
  });

  it('requires a session for personal endpoints', async () => {
    const { app } = buildTestApp();
    await request(app).get('/api/bookings/mine').expect(401);
    await request(app).post('/api/bookings').send({}).expect(401);
  });

  it('requires JSON bodies for state-changing requests (CSRF defence)', async () => {
    const { app } = buildTestApp();
    await request(app).post('/api/session').type('form').send('personaId=f-rao').expect(415);
  });

  it('rejects oversized and malformed payloads without leaking internals', async () => {
    const { app } = buildTestApp();
    const huge = await request(app)
      .post('/api/ai/search')
      .send({ query: 'x'.repeat(20_000) })
      .expect(413);
    expect(huge.body.error.message).toBe('Malformed request body');
    const bad = await request(app)
      .post('/api/ai/search')
      .set('Content-Type', 'application/json')
      .send('{"query":')
      .expect(400);
    expect(JSON.stringify(bad.body)).not.toMatch(/at .*\.ts/);
  });

  it('validates input with field-level details', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/ai/search').send({ query: 'x' }).expect(400);
    expect(res.body.error.details.fieldErrors.query).toBeDefined();
  });

  it('rate limits AI endpoints', async () => {
    const app = createApp(buildTestServices(), { log: { error: () => undefined } });
    const agent = request(app);
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++)
      statuses.push((await agent.post('/api/ai/search').send({ query: 'oscilloscope' })).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('returns JSON 404s for unknown API routes', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
