import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // api.ts holds type-only contracts.
      exclude: ['src/api.ts'],
      thresholds: { lines: 90, functions: 85, branches: 75, statements: 90 },
    },
  },
});
