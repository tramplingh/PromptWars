import type { Express, Request, Response } from 'express';
import { createApp } from './app.js';
import { buildServices } from './bootstrap.js';
import { loadConfig } from './config.js';

/**
 * Vercel serverless entry. The app is built once per warm instance and reused
 * across invocations; static files are served by Vercel's CDN, not Express.
 */
let appPromise: Promise<Express> | undefined;

function getApp(): Promise<Express> {
  appPromise ??= buildServices(loadConfig()).then((services) => createApp(services));
  // Allow a retry on the next request if start-up failed (e.g. transient Firestore error).
  appPromise.catch(() => {
    appPromise = undefined;
  });
  return appPromise;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const app = await getApp();
    app(req, res);
  } catch (error) {
    console.error('[vercel] start-up failed', error);
    res
      .status(503)
      .json({ error: { code: 'UNAVAILABLE', message: 'Service is starting up. Please retry.' } });
  }
}
