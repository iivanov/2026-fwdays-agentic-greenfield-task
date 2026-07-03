import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['./tests/setup/supabase-prerequisite.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
