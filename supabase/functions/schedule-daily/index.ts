/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { withSupabase } from '@supabase/server';
import { createClient } from '@supabase/supabase-js';

const logScheduleEvent = (
  level: 'info' | 'error',
  event: string,
  context: Record<string, unknown>,
) => {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...context,
  };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(payload));
};

export const scheduleDailyHandler = async (req: Request, envs: Record<string, string>) => {
  const startedAt = Date.now();
  const correlationId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceKey = envs.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Service key not configured' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isAuthorized = authHeader === `Bearer ${serviceKey}` || authHeader === serviceKey;
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(envs.SUPABASE_URL ?? '', serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabaseAdmin.rpc('schedule_daily_flows');
  if (error) {
    logScheduleEvent('error', 'schedule_daily.failed', {
      correlation_id: correlationId,
      duration_ms: Date.now() - startedAt,
      error_code: 'schedule_daily_rpc_failed',
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  logScheduleEvent('info', 'schedule_daily.completed', {
    correlation_id: correlationId,
    duration_ms: Date.now() - startedAt,
    ...(data && typeof data === 'object' ? (data as Record<string, unknown>) : {}),
  });
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export default {
  fetch: withSupabase({ auth: ['secret'] }, async (req) => {
    try {
      const envs = {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      };
      return await scheduleDailyHandler(req, envs);
    } catch (err: unknown) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Internal Server Error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }),
};
