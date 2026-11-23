import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // Process entry points and adapters for live Google services are exercised in
      // deployment, not unit tests (they are thin wrappers behind tested interfaces).
      exclude: [
        'src/index.ts',
        'src/dev.ts',
        'src/vercel.ts',
        'src/bootstrap.ts',
        'src/ai/geminiClient.ts',
        'src/repositories/firestoreBookingRepository.ts',
      ],
      thresholds: { lines: 85, functions: 80, branches: 75, statements: 85 },
    },
  },
});
