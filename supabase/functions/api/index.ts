/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { withSupabase } from '@supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders, apiHandler, sendError } from './helpers.ts';

export default {
  fetch: withSupabase({ auth: ['publishable', 'secret'] }, async (req, ctx) => {
    // Handle CORS preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: getCorsHeaders(req) });
    }

    try {
      // Initialize admin client with elevated service role permissions
      ctx.supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      );

      return await apiHandler(req, ctx);
    } catch (err: unknown) {
      return sendError(err instanceof Error ? err.message : 'Internal Server Error', req, 500);
    }
  }),
};
