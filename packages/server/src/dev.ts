/**
 * Local development entry. The web dev server owns PORT (5173) and proxies /api
 * here, so the API always listens on API_PORT (default 8080) during development.
 */
process.env.PORT = process.env.API_PORT ?? '8080';
await import('./index.js');
export {};
