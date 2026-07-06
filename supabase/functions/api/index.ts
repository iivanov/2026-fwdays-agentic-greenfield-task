/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { withSupabase } from '@supabase/server';
import { apiHandler, getCorsHeaders, sendError } from './helpers.ts';

export default {
  fetch: withSupabase({ auth: ['user', 'none'] }, async (req, ctx) => {
    // Handle CORS preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: getCorsHeaders(req) });
    }

    try {
      return await apiHandler(req, ctx);
    } catch (err: unknown) {
      return sendError(err instanceof Error ? err.message : 'Internal Server Error', req, 500);
    }
  }),
};
