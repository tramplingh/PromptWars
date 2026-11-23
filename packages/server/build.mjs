// Bundles the server (including the TypeScript @lablink/shared workspace package)
// into plain ESM. npm dependencies stay external and are traced at deploy time.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@lablink/'));

await build({
  entryPoints: ['src/index.ts', 'src/vercel.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external: [...external, 'firebase-admin/*'],
  logLevel: 'info',
});
