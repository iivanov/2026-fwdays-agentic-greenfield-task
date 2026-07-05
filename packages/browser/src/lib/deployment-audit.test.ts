import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../../..');

describe('deployment bootstrap audit', () => {
  it('passes without printing secret values', () => {
    const output = execFileSync(process.execPath, ['infra/scripts/audit-deployment.mjs'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENAI_API_KEY: 'must-not-appear',
        SUPABASE_SERVICE_ROLE_KEY: 'must-not-appear',
      },
    });

    expect(output).toContain('Deployment audit passed.');
    expect(output).toContain('human-bootstrap: Create Supabase Free project');
    expect(output).not.toContain('must-not-appear');
  });

  it('keeps Vercel static-only with SPA fallback and security headers', () => {
    const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
    const headers = new Set(
      vercel.headers.flatMap((entry: { headers: Array<{ key: string }> }) =>
        entry.headers.map((header) => header.key.toLowerCase()),
      ),
    );

    expect(vercel.framework).toBe('vite');
    expect(vercel.buildCommand).toBe('npm run build --workspace @news-aggregator/browser');
    expect(vercel.outputDirectory).toBe('packages/browser/dist');
    expect(vercel.rewrites).toContainEqual(expect.objectContaining({ destination: '/index.html' }));
    expect(vercel.functions).toBeUndefined();
    expect(vercel.crons).toBeUndefined();
    expect(JSON.stringify(vercel.rewrites)).not.toContain('supabase.co');
    expect([...headers]).toEqual(
      expect.arrayContaining([
        'content-security-policy',
        'permissions-policy',
        'referrer-policy',
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
        'cache-control',
      ]),
    );
  });
});
