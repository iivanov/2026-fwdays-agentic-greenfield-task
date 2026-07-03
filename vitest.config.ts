import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      // R-12 ingestion-worker is an active draft and must not affect R-11B unit gates.
      'packages/browser/src/lib/ingestion-worker.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['packages/shared/src/**/*.ts', 'supabase/functions/api/{crypto,ssrf}.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
