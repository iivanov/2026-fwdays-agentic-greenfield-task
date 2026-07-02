import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supabase Client Proxy', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should not throw on module import even if environment variables are missing', async () => {
    // Dynamically import to simulate module load
    const importModule = () => import('./supabase.js');
    await expect(importModule()).resolves.toBeDefined();
  });

  it('should throw a descriptive error when accessing properties on the proxy if env variables are missing', async () => {
    const { supabase } = await import('./supabase.js');
    expect(() => supabase.auth).toThrowError(
      'Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set to use the Supabase client.',
    );
  });
});
