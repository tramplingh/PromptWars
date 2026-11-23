import { z } from 'zod';

const MIN_SECRET_LENGTH = 32;
const DEV_SECRET = 'lablink-local-development-secret-do-not-use-in-prod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().default('gemini-2.5-flash'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  SESSION_SECRET: z.string().optional(),
  DATA_BACKEND: z.enum(['memory', 'firestore']).default('memory'),
  GOOGLE_CLOUD_PROJECT: z.string().trim().optional(),
  /** Base64-encoded service-account JSON; used on hosts without ADC (e.g. Vercel). */
  FIREBASE_SERVICE_ACCOUNT: z.string().trim().optional(),
  CAMPUS_TIMEZONE: z.string().default('Asia/Kolkata'),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  port: number;
  gemini: { apiKey?: string; model: string; timeoutMs: number };
  sessionSecret: string;
  dataBackend: 'memory' | 'firestore';
  firestore: { projectId?: string; serviceAccountBase64?: string };
  campusTimeZone: string;
}

/**
 * Parses and validates environment variables once at start-up so the rest of
 * the code base works with a typed, trusted configuration object.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const isProduction = parsed.NODE_ENV === 'production';

  const secret = parsed.SESSION_SECRET ?? (isProduction ? undefined : DEV_SECRET);
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`);
  }

  return {
    env: parsed.NODE_ENV,
    port: parsed.PORT,
    gemini: {
      apiKey: parsed.GEMINI_API_KEY || undefined,
      model: parsed.GEMINI_MODEL,
      timeoutMs: parsed.GEMINI_TIMEOUT_MS,
    },
    sessionSecret: secret,
    dataBackend: parsed.DATA_BACKEND,
    firestore: {
      projectId: parsed.GOOGLE_CLOUD_PROJECT || undefined,
      serviceAccountBase64: parsed.FIREBASE_SERVICE_ACCOUNT || undefined,
    },
    campusTimeZone: parsed.CAMPUS_TIMEZONE,
  };
}
