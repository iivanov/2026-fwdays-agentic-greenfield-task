/**
 * Supabase client for the browser package.
 *
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the Vite environment.
 * Configures the PKCE auth flow type as required by T-06 / NFR-SEC-01.
 *
 * Defer initialization to avoid import-time crashes when environment
 * variables are missing (e.g. during build, tests, or monorepo linting).
 *
 * Usage:
 *   import { supabase } from '@news-aggregator/browser';
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let clientInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseClient(): SupabaseClient {
  if (!clientInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set to use the Supabase client.',
      );
    }
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}

// Lazy proxy for the SupabaseClient to prevent import-time crashes.
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const instance = getSupabaseClient();
    const value = Reflect.get(instance, prop);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

export type { SupabaseClient } from '@supabase/supabase-js';
