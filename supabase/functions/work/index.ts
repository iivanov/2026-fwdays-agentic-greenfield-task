/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from '@supabase/supabase-js';
import { createWorkHandler } from './handler.ts';
import type { SupabaseAdmin } from './types.ts';

export * from './handler.ts';
export * from './ingestion.ts';
export * from './processing.ts';
export * from './delivery.ts';
export type * from './types.ts';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const workHandler = createWorkHandler((url, serviceKey) =>
  createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseAdmin
);

export default {
  fetch: async (req: Request) => {
    try {
      const envs = {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        SCHEDULER_SECRET: Deno.env.get('SCHEDULER_SECRET') ?? '',
        OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY') ?? '',
        BREVO_API_KEY: Deno.env.get('BREVO_API_KEY') ?? '',
        BREVO_SENDER_EMAIL: Deno.env.get('BREVO_SENDER_EMAIL') ?? '',
        OPERATOR_ALERT_EMAIL: Deno.env.get('OPERATOR_ALERT_EMAIL') ?? '',
        AI_DAILY_TOKEN_BUDGET: Deno.env.get('AI_DAILY_TOKEN_BUDGET') ?? '',
        AI_RESPONSE_TOKEN_BUDGET: Deno.env.get('AI_RESPONSE_TOKEN_BUDGET') ?? '',
        TELEGRAM_BOT_TOKEN: Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '',
        MASTER_CRYPTO_KEY: Deno.env.get('MASTER_CRYPTO_KEY') ?? '',
      };
      return await workHandler(req, envs);
    } catch (err: unknown) {
      return json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
    }
  },
};
