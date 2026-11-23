import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { buildServices } from './bootstrap.js';
import { loadConfig } from './config.js';

/** Long-running server entry (local dev, Docker). Vercel uses `vercel.ts` instead. */
async function main(): Promise<void> {
  const config = loadConfig();
  const services = await buildServices(config);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.resolve(here, '../../web/dist');
  const app = createApp(services, {
    staticDir: existsSync(webDist) && config.env === 'production' ? webDist : undefined,
  });

  app.listen(config.port, () => {
    console.info(
      `LabLink API listening on http://localhost:${config.port} (storage: ${config.dataBackend}, AI: ${services.ai.enabled ? config.gemini.model : 'rule-based fallback'})`,
    );
  });
}

main().catch((error: unknown) => {
  console.error('Failed to start LabLink', error);
  process.exit(1);
});
