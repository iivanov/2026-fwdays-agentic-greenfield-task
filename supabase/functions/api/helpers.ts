import { z, type ZodIssue } from 'zod';

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
    return sendSuccess(
      {
        message: 'Profiles endpoint skeleton',
        userId: user.id,
        method: req.method,
      },
      req,
    );
  }

  if (rootSegment === 'sources') {
    return sendSuccess(
      {
        message: 'Sources endpoint skeleton',
        userId: user.id,
        method: req.method,
      },
      req,
    );
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

  return await handleApiRoute(req, user, rootSegment, route);
}
