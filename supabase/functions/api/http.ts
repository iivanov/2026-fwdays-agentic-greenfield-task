import { z, type ZodIssue } from 'zod';

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
