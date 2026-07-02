import { z, type ZodIssue } from 'zod';
import { validateUrlSsrf, type DnsResolver } from './ssrf.ts';

// CORS allowed origins allowlist
export const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

// Returns CORS headers dynamically based on request Origin
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  let allowedOrigin = '';
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      allowedOrigin = origin;
    }
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin || 'http://localhost:3000',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Response envelope wrappers
export function sendSuccess<T>(data: T, req: Request, status = 200): Response {
  return new Response(JSON.stringify({ data, error: null }), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

export function sendError(message: string, req: Request, status = 400): Response {
  return new Response(JSON.stringify({ data: null, error: message }), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// Zod validation helper
export async function validateBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const formattedErrors = result.error.issues
        .map((err: ZodIssue) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return { success: false, error: formattedErrors };
    }
    return { success: true, data: result.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Malformed JSON body',
    };
  }
}

// Route mapping handler
export async function handleApiRoute(
  req: Request,
  user: { id: string } | null,
  rootSegment: string,
  route: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  resolveDns?: DnsResolver,
): Promise<Response> {
  // 1. Health check route (public, does not require JWT)
  if (rootSegment === 'health' || rootSegment === '') {
    return sendSuccess({ status: 'healthy', timestamp: new Date().toISOString() }, req);
  }

  // 2. Authenticate request using user JWT check
  if (!user) {
    return sendError('Unauthorized', req, 401);
  }

  // 3. Router matching
  if (rootSegment === 'profiles') {
    if (req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, email, interests, language_preferences')
        .eq('id', user.id)
        .single();
      if (error) {
        return sendError(error.message, req, 500);
      }
      return sendSuccess(data, req);
    }

    if (req.method === 'PUT') {
      const profileSchema = z.object({
        interests: z.array(z.string()),
        language_preferences: z.array(z.string()),
      });
      const validation = await validateBody(req, profileSchema);
      if (!validation.success) {
        return sendError(validation.error, req, 400);
      }
      const { interests, language_preferences } = validation.data;
      const { data, error } = await supabaseClient
        .from('profiles')
        .update({ interests, language_preferences })
        .eq('id', user.id)
        .select('id, email, interests, language_preferences')
        .single();
      if (error) {
        return sendError(error.message, req, 500);
      }
      return sendSuccess(data, req);
    }

    return sendError('Method Not Allowed', req, 405);
  }

  if (rootSegment === 'sources') {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const flowIdParam = url.searchParams.get('flow_id');

      let query = supabaseClient.from('flow_sources').select(`
          flow_id,
          global_sources (
            id,
            url,
            type,
            status,
            failed_fetch_count,
            last_fetched_at
          )
        `);

      if (flowIdParam) {
        query = query.eq('flow_id', flowIdParam);
      }

      const { data, error } = await query;
      if (error) {
        return sendError(error.message, req, 500);
      }
      return sendSuccess(data, req);
    }

    if (req.method === 'POST') {
      const sourceSchema = z.object({
        url: z.string().url(),
        type: z.enum(['rss', 'atom', 'web']),
        flow_id: z.string().uuid(),
      });

      const validation = await validateBody(req, sourceSchema);
      if (!validation.success) {
        return sendError(validation.error, req, 400);
      }

      const { url: sourceUrl, type, flow_id } = validation.data;

      // Validate URL against SSRF policy
      const isUrlSafe = await validateUrlSsrf(sourceUrl, resolveDns);
      if (!isUrlSafe) {
        return sendError('SSRF validation failed: Unsafe or private host', req, 400);
      }

      // Check if user owns the flow_id
      const { data: flow, error: flowError } = await supabaseClient
        .from('processing_flows')
        .select('id')
        .eq('id', flow_id)
        .single();

      if (flowError || !flow) {
        return sendError('Flow not found or unauthorized access', req, 404);
      }

      // 1. Get or Create global source record using admin client (service role)
      let sourceId: string;
      const adminClient = supabaseAdmin || supabaseClient;

      const { data: existingSource } = await adminClient
        .from('global_sources')
        .select('id')
        .eq('url', sourceUrl)
        .maybeSingle();

      if (existingSource) {
        sourceId = existingSource.id;
      } else {
        const { data: newSource, error: insertError } = await adminClient
          .from('global_sources')
          .insert({
            url: sourceUrl,
            type,
            status: 'active',
            failed_fetch_count: 0,
          })
          .select('id')
          .single();

        if (insertError) {
          return sendError(insertError.message, req, 500);
        }
        sourceId = newSource.id;
      }

      // 2. Link flow to global source using user client
      const { error: linkError } = await supabaseClient
        .from('flow_sources')
        .insert({ flow_id, source_id: sourceId });

      if (linkError) {
        if (linkError.code === '23505') {
          return sendError('Source is already connected to this flow', req, 409);
        }
        return sendError(linkError.message, req, 500);
      }

      return sendSuccess({ connected: true, sourceId }, req, 201);
    }

    if (req.method === 'DELETE') {
      const deleteSchema = z.object({
        flow_id: z.string().uuid(),
        source_id: z.string().uuid(),
      });

      const validation = await validateBody(req, deleteSchema);
      if (!validation.success) {
        return sendError(validation.error, req, 400);
      }

      const { flow_id, source_id } = validation.data;

      const { error: deleteError, data } = await supabaseClient
        .from('flow_sources')
        .delete()
        .eq('flow_id', flow_id)
        .eq('source_id', source_id)
        .select();

      if (deleteError) {
        return sendError(deleteError.message, req, 500);
      }

      if (!data || data.length === 0) {
        return sendError('Connection not found or unauthorized access', req, 404);
      }

      return sendSuccess({ disconnected: true }, req);
    }

    return sendError('Method Not Allowed', req, 405);
  }

  if (rootSegment === 'flows') {
    return sendSuccess(
      {
        message: 'Flows endpoint skeleton',
        userId: user.id,
        method: req.method,
      },
      req,
    );
  }

  if (rootSegment === 'channels') {
    return sendSuccess(
      {
        message: 'Channels endpoint skeleton',
        userId: user.id,
        method: req.method,
      },
      req,
    );
  }

  // Route not found
  return sendError(`Route not found: ${route}`, req, 404);
}

// Router request lifecycle handler (decoupled from @supabase/server for unit testing)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiHandler(req: Request, ctx: any): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Parse route segment by removing function prefix
  let route = path;
  if (route.startsWith('/functions/v1/api/')) {
    route = route.slice('/functions/v1/api/'.length);
  } else if (route === '/functions/v1/api') {
    route = '';
  }

  const segments = route.split('/').filter(Boolean);
  const rootSegment = segments[0] || '';

  // Health check route is public (does not require JWT or auth client calls)
  if (rootSegment === 'health' || rootSegment === '') {
    return sendSuccess({ status: 'healthy', timestamp: new Date().toISOString() }, req);
  }

  // Authenticate request using user JWT
  let user: { id: string } | null = null;
  try {
    const { data, error } = await ctx.supabase.auth.getUser();
    if (!error && data?.user) {
      user = { id: data.user.id };
    }
  } catch {
    // Auth client failed or parsed invalid token
  }

  return await handleApiRoute(
    req,
    user,
    rootSegment,
    route,
    ctx.supabase,
    ctx.supabaseAdmin,
    ctx.resolveDns,
  );
}
