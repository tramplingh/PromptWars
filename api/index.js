// Vercel serverless function: every /api/* request is rewritten here (see vercel.json).
// The handler is the bundled Express app produced by `npm run build`.
export { default } from '../packages/server/dist/vercel.js';
