import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.playwright/**',
      '.agent/**',
      '.agents/**',
      '.codex/**',
      'coverage/**',
      'eslint.config.js',
    ],
  },
  {
    files: ['infra/scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    files: ['docs/demo-video/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    files: [
      'packages/**/*.{ts,tsx}',
      'supabase/functions/**/*.ts',
      'infra/scripts/**/*.mjs',
      'docs/demo-video/**/*.mjs',
    ],
    ignores: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.integration.{ts,tsx}',
      'tests/**',
      'supabase/functions/node_modules/**',
    ],
    rules: {
      complexity: ['error', { max: 40 }],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 1000, skipBlankLines: true, skipComments: true }],
      'max-nested-callbacks': ['error', 4],
      'max-params': ['error', 6],
    },
  },
  {
    files: ['supabase/functions/api/router.ts'],
    rules: {
      complexity: ['error', { max: 170 }],
      'max-depth': ['error', 5],
      'max-params': ['error', 7],
    },
  },
  {
    files: ['supabase/functions/api/ssrf.ts'],
    rules: {
      complexity: ['error', { max: 80 }],
    },
  },
  {
    files: ['supabase/functions/work/handler.ts'],
    rules: {
      complexity: ['error', { max: 90 }],
      'max-depth': ['error', 5],
      'max-params': ['error', 7],
    },
  },
  {
    files: ['supabase/functions/work/logging.ts'],
    rules: {
      'max-params': ['error', 7],
    },
  },
);
