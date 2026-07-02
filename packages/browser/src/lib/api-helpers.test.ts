import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  sendSuccess,
  sendError,
  validateBody,
  handleApiRoute,
  getCorsHeaders,
} from '../../../../supabase/functions/api/helpers.js';
import { apiHandler } from '../../../../supabase/functions/api/helpers.js';

describe('API Edge Function Helpers & Router Unit Tests', () => {
  it('should verify CORS headers structure', () => {
    const req = new Request('http://localhost', {
      headers: { Origin: 'http://localhost:3000' },
    });
    const headers = getCorsHeaders(req);
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
  });

  it('should dynamically return CORS origin for allowed domains', () => {
    const req1 = new Request('http://localhost/test', {
      headers: { Origin: 'http://localhost:3000' },
    });
    const headers1 = getCorsHeaders(req1);
    expect(headers1['Access-Control-Allow-Origin']).toBe('http://localhost:3000');

    const req2 = new Request('http://localhost/test', {
      headers: { Origin: 'https://my-app.vercel.app' },
    });
    const headers2 = getCorsHeaders(req2);
    expect(headers2['Access-Control-Allow-Origin']).toBe('https://my-app.vercel.app');

    const req3 = new Request('http://localhost/test', {
      headers: { Origin: 'https://malicious.com' },
    });
    const headers3 = getCorsHeaders(req3);
    expect(headers3['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
  });

  it('should verify success envelope structure', async () => {
    const req = new Request('http://localhost');
    const response = sendSuccess({ payload: 'test' }, req);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const json = await response.json();
    expect(json).toEqual({
      data: { payload: 'test' },
      error: null,
    });
  });

  it('should verify error envelope structure', async () => {
    const req = new Request('http://localhost');
    const response = sendError('Resource not found', req, 404);
    expect(response.status).toBe(404);

    const json = await response.json();
    expect(json).toEqual({
      data: null,
      error: 'Resource not found',
    });
  });

  it('should validate Zod schema correctly with valid request body', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().min(18),
    });

    const mockRequest = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice', age: 20 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await validateBody(mockRequest, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'Alice', age: 20 });
    }
  });

  it('should fail validation and return errors for invalid schemas', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().min(18),
    });

    const mockRequest = new Request('http://localhost/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice', age: 10 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await validateBody(mockRequest, schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('age:');
    }
  });

  it('should route to health endpoint publicly without authentication', async () => {
    const req = new Request('http://localhost/functions/v1/api/health', {
      method: 'GET',
    });
    const res = await handleApiRoute(req, null, 'health', 'health', null);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('healthy');
    expect(json.error).toBeNull();
  });

  it('should reject profiles route when user is unauthenticated', async () => {
    const req = new Request('http://localhost/functions/v1/api/profiles', {
      method: 'GET',
    });
    const res = await handleApiRoute(req, null, 'profiles', 'profiles', null);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should return profiles payload when authenticated GET is invoked', async () => {
    const req = new Request('http://localhost/functions/v1/api/profiles', {
      method: 'GET',
    });
    const mockProfile = {
      id: 'test-user-id',
      email: 'test@example.com',
      interests: ['ai'],
      language_preferences: ['en'],
    };

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: mockProfile, error: null }),
          }),
        }),
      }),
    };

    const res = await handleApiRoute(
      req,
      { id: 'test-user-id' },
      'profiles',
      'profiles',
      mockSupabase,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(mockProfile);
  });

  it('should update profiles payload when authenticated PUT is invoked with valid body', async () => {
    const req = new Request('http://localhost/functions/v1/api/profiles', {
      method: 'PUT',
      body: JSON.stringify({
        interests: ['tech', 'sports'],
        language_preferences: ['en', 'uk'],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const mockSupabase = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: 'test-user-id',
                  email: 'test@example.com',
                  interests: ['tech', 'sports'],
                  language_preferences: ['en', 'uk'],
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const res = await handleApiRoute(
      req,
      { id: 'test-user-id' },
      'profiles',
      'profiles',
      mockSupabase,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.interests).toEqual(['tech', 'sports']);
    expect(json.data.language_preferences).toEqual(['en', 'uk']);
  });

  it('should fail profile update when invalid schema is passed', async () => {
    const req = new Request('http://localhost/functions/v1/api/profiles', {
      method: 'PUT',
      body: JSON.stringify({
        interests: 'not-an-array',
        language_preferences: ['en'],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleApiRoute(req, { id: 'test-user-id' }, 'profiles', 'profiles', {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('interests:');
  });
});

describe('API Edge Function Handler Integration Tests', () => {
  it('should verify health endpoint routing handles trailing slash publicly without auth getUser calls', async () => {
    const req = new Request('http://localhost/functions/v1/api/health/', {
      method: 'GET',
    });
    const ctx = {
      supabase: {
        auth: {
          getUser: () => {
            throw new Error('getUser should not be called');
          },
        },
      },
    };
    const res = await apiHandler(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('healthy');
  });

  it('should reject weak prefix matching sibling route /functions/v1/apihealth and not serve health publicly', async () => {
    const req = new Request('http://localhost/functions/v1/apihealth', {
      method: 'GET',
    });
    const getUserMock = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    const ctx = {
      supabase: {
        auth: {
          getUser: getUserMock,
        },
      },
    };
    const res = await apiHandler(req, ctx);
    expect(res.status).toBe(401);
  });

  it('should return 404 for prefix sibling routes like /functions/v1/api/profiles-xyz for authenticated users', async () => {
    const req = new Request('http://localhost/functions/v1/api/profiles-xyz', {
      method: 'GET',
    });
    const ctx = {
      supabase: {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'test-id' } },
            error: null,
          }),
        },
      },
    };
    const res = await apiHandler(req, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain('Route not found: profiles-xyz');
  });

  it('should authenticate and route valid profiles requests', async () => {
    const req = new Request('http://localhost/functions/v1/api/profiles', {
      method: 'GET',
    });
    const ctx = {
      supabase: {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'user-abc' } },
            error: null,
          }),
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'user-abc',
                  email: 'abc@example.com',
                  interests: [],
                  language_preferences: [],
                },
                error: null,
              }),
            }),
          }),
        }),
      },
    };
    const res = await apiHandler(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe('user-abc');
  });
});
