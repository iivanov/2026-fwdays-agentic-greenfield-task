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
import {
  decryptConfig,
  encryptConfig,
  getMasterKey,
} from '../../../../supabase/functions/api/crypto.js';

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
    const res = await handleApiRoute(req, null, 'health', 'health', null, null);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('healthy');
    expect(json.error).toBeNull();
  });

  it('should reject profiles route when user is unauthenticated', async () => {
    const req = new Request('http://localhost/functions/v1/api/profiles', {
      method: 'GET',
    });
    const res = await handleApiRoute(req, null, 'profiles', 'profiles', null, null);
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
      null,
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
      null,
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

    const res = await handleApiRoute(req, { id: 'test-user-id' }, 'profiles', 'profiles', {}, null);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('interests:');
  });

  it('should retrieve sources connected to flows successfully', async () => {
    const req = new Request('http://localhost/functions/v1/api/sources', {
      method: 'GET',
    });

    const mockFlowSources = [
      {
        flow_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        global_sources: {
          id: 'e8a3a2d3-2b2a-4c28-98e6-e91b5b9c09c9',
          url: 'https://example.com/rss',
          type: 'rss',
          status: 'active',
        },
      },
    ];

    const mockSupabase = {
      from: () => ({
        select: () => ({
          then: (cb: (arg: { data: typeof mockFlowSources; error: null }) => void) =>
            cb({ data: mockFlowSources, error: null }),
        }),
      }),
    };

    const res = await handleApiRoute(
      req,
      { id: 'user-123' },
      'sources',
      'sources',
      mockSupabase,
      null,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(mockFlowSources);
  });

  it('should reject POST source addition on unsafe SSRF URL target', async () => {
    const req = new Request('http://localhost/functions/v1/api/sources', {
      method: 'POST',
      body: JSON.stringify({
        url: 'http://127.0.0.1/rss',
        type: 'rss',
        flow_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleApiRoute(req, { id: 'user-123' }, 'sources', 'sources', {}, null);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('SSRF validation failed');
  });

  it('should add a new global source and link it to flow successfully', async () => {
    const req = new Request('http://localhost/functions/v1/api/sources', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://news.ycombinator.com/rss',
        type: 'rss',
        flow_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const mockSupabaseUser = {
      from: (table: string) => {
        if (table === 'processing_flows') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'flow_sources') {
          return {
            insert: async () => ({ error: null }),
          };
        }
        return {};
      },
    };

    const mockSupabaseAdmin = {
      from: (table: string) => {
        if (table === 'global_sources') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: 'src-new-id' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const mockDnsResolver = async () => ['8.8.8.8'];

    const res = await handleApiRoute(
      req,
      { id: 'user-123' },
      'sources',
      'sources',
      mockSupabaseUser,
      mockSupabaseAdmin,
      mockDnsResolver,
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.connected).toBe(true);
    expect(json.data.sourceId).toBe('src-new-id');
  });

  it('should disconnect a source from flow successfully', async () => {
    const req = new Request('http://localhost/functions/v1/api/sources', {
      method: 'DELETE',
      body: JSON.stringify({
        flow_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        source_id: 'e8a3a2d3-2b2a-4c28-98e6-e91b5b9c09c9',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'flow_sources') {
          return {
            delete: () => ({
              eq: () => ({
                eq: () => ({
                  select: async () => ({
                    data: [{ flow_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const res = await handleApiRoute(
      req,
      { id: 'user-123' },
      'sources',
      'sources',
      mockSupabase,
      null,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.disconnected).toBe(true);
  });

  it('should return 404 on DELETE when source connection does not exist', async () => {
    const req = new Request('http://localhost/functions/v1/api/sources', {
      method: 'DELETE',
      body: JSON.stringify({
        flow_id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        source_id: 'e8a3a2d3-2b2a-4c28-98e6-e91b5b9c09c9',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'flow_sources') {
          return {
            delete: () => ({
              eq: () => ({
                eq: () => ({
                  select: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const res = await handleApiRoute(
      req,
      { id: 'user-123' },
      'sources',
      'sources',
      mockSupabase,
      null,
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain('Connection not found or unauthorized access');
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

  describe('/flows endpoints routing', () => {
    const validFlowId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

    it('should retrieve flows for user successfully and decrypt custom prompts for the owner', async () => {
      const req = new Request('http://localhost/functions/v1/api/flows', {
        method: 'GET',
      });

      const encryptedPrompt = await encryptConfig(
        { prompt_template: 'Focus on TypeScript security.' },
        getMasterKey(),
      );
      const mockFlows = [
        {
          id: validFlowId,
          name: 'Briefing',
          prompt_type: 'custom',
          prompt_template: JSON.stringify(encryptedPrompt),
        },
      ];
      const mockSupabase = {
        from: () => ({
          select: () => ({
            order: async () => ({ data: mockFlows, error: null }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        'flows',
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual([
        {
          id: validFlowId,
          name: 'Briefing',
          prompt_type: 'custom',
          prompt_template: 'Focus on TypeScript security.',
        },
      ]);
    });

    it('should constrain service-role flow reads by the authenticated user before decrypting prompts', async () => {
      const req = new Request('http://localhost/functions/v1/api/flows', { method: 'GET' });
      const encryptedPrompt = await encryptConfig(
        { prompt_template: 'User scoped prompt' },
        getMasterKey(),
      );
      const eqCalls: Array<[string, string]> = [];
      const mockSupabaseAdmin = {
        from: () => ({
          select: () => ({
            eq: (column: string, value: string) => {
              eqCalls.push([column, value]);
              return {
                order: async () => ({
                  data: [
                    {
                      id: validFlowId,
                      name: 'Briefing',
                      prompt_type: 'custom',
                      prompt_template: JSON.stringify(encryptedPrompt),
                    },
                  ],
                  error: null,
                }),
              };
            },
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        'flows',
        {},
        mockSupabaseAdmin,
      );

      expect(res.status).toBe(200);
      expect(eqCalls).toEqual([['user_id', 'user-abc']]);
      const json = await res.json();
      expect(json.data[0].prompt_template).toBe('User scoped prompt');
    });

    it('should create new custom flow with encrypted prompt storage and plaintext owner response', async () => {
      const req = new Request('http://localhost/functions/v1/api/flows', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Tech Briefing',
          prompt_type: 'custom',
          prompt_template: 'Focus on TypeScript',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      let storedPayload: Record<string, unknown> | null = null;
      const mockSupabase = {
        from: () => ({
          insert: (payload: Record<string, unknown>) => {
            storedPayload = payload;
            return {
              select: () => ({
                single: async () => ({
                  data: { id: validFlowId, name: 'Tech Briefing', ...payload },
                  error: null,
                }),
              }),
            };
          },
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        'flows',
        mockSupabase,
        null,
      );
      expect(res.status).toBe(201);
      expect(storedPayload?.prompt_template).not.toBe('Focus on TypeScript');
      expect(typeof storedPayload?.prompt_template).toBe('string');
      const encryptedPrompt = JSON.parse(storedPayload?.prompt_template as string);
      expect(encryptedPrompt).toHaveProperty('ciphertext');
      const decryptedPrompt = await decryptConfig(encryptedPrompt, getMasterKey());
      expect(decryptedPrompt).toEqual({ prompt_template: 'Focus on TypeScript' });

      const json = await res.json();
      expect(json.data.id).toBe(validFlowId);
      expect(json.data.prompt_template).toBe('Focus on TypeScript');
    });

    it('should not echo custom prompt bodies when flow persistence fails', async () => {
      const secretPrompt = 'DO-NOT-LEAK-R-11C-PROMPT';
      const req = new Request('http://localhost/functions/v1/api/flows', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Tech Briefing',
          prompt_type: 'custom',
          prompt_template: secretPrompt,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const mockSupabase = {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { message: `database rejected ${secretPrompt}` },
              }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        'flows',
        mockSupabase,
        null,
      );
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).not.toContain(secretPrompt);
      expect(text).toContain('Unable to create processing flow');
    });

    it('should handle quota limit triggers during POST creation and return 400', async () => {
      const req = new Request('http://localhost/functions/v1/api/flows', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Exceeding Flow',
          prompt_type: 'predefined',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const mockSupabase = {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { message: 'User exceeds the maximum quota of 5 processing flows' },
              }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        'flows',
        mockSupabase,
        null,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('maximum quota');
    });

    it('should update flow settings successfully via PUT', async () => {
      const req = new Request(`http://localhost/functions/v1/api/flows/${validFlowId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          is_enabled: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const mockSupabase = {
        from: () => ({
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: validFlowId, name: 'Updated Name', is_enabled: false },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.is_enabled).toBe(false);
    });

    it('should clear stored prompt data when updating a flow to predefined prompts', async () => {
      const req = new Request(`http://localhost/functions/v1/api/flows/${validFlowId}`, {
        method: 'PUT',
        body: JSON.stringify({
          prompt_type: 'predefined',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      let updatePayload: Record<string, unknown> | null = null;
      const mockSupabase = {
        from: () => ({
          update: (payload: Record<string, unknown>) => {
            updatePayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: { id: validFlowId, ...payload },
                    error: null,
                  }),
                }),
              }),
            };
          },
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
      expect(updatePayload).toMatchObject({ prompt_type: 'predefined', prompt_template: null });
      const json = await res.json();
      expect(json.data.prompt_template).toBeNull();
    });

    it('should constrain service-role flow updates by the authenticated user before returning decrypted prompts', async () => {
      const req = new Request(`http://localhost/functions/v1/api/flows/${validFlowId}`, {
        method: 'PUT',
        body: JSON.stringify({ prompt_type: 'custom', prompt_template: 'Scoped update prompt' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const eqCalls: Array<[string, string]> = [];
      const mockSupabaseAdmin = {
        from: () => ({
          update: (payload: Record<string, unknown>) => ({
            eq: (column: string, value: string) => {
              eqCalls.push([column, value]);
              return {
                eq: (nextColumn: string, nextValue: string) => {
                  eqCalls.push([nextColumn, nextValue]);
                  return {
                    select: () => ({
                      single: async () => ({
                        data: { id: validFlowId, ...payload },
                        error: null,
                      }),
                    }),
                  };
                },
                select: () => ({
                  single: async () => ({ data: { id: validFlowId, ...payload }, error: null }),
                }),
              };
            },
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}`,
        {},
        mockSupabaseAdmin,
      );

      expect(res.status).toBe(200);
      expect(eqCalls).toEqual([
        ['id', validFlowId],
        ['user_id', 'user-abc'],
      ]);
      const json = await res.json();
      expect(json.data.prompt_template).toBe('Scoped update prompt');
    });

    it('should return 404 on PUT if flow does not exist or user does not own it', async () => {
      const req = new Request(`http://localhost/functions/v1/api/flows/${validFlowId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Missing Flow',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const mockSupabase = {
        from: () => ({
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(404);
    });

    it('should delete flow successfully via DELETE', async () => {
      const req = new Request(`http://localhost/functions/v1/api/flows/${validFlowId}`, {
        method: 'DELETE',
      });

      const mockSupabase = {
        from: () => ({
          delete: () => ({
            eq: () => ({
              select: async () => ({ data: [{ id: validFlowId }], error: null }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.deleted).toBe(true);
    });

    it('should return 404 on DELETE if flow does not exist or user does not own it', async () => {
      const req = new Request(`http://localhost/functions/v1/api/flows/${validFlowId}`, {
        method: 'DELETE',
      });

      const mockSupabase = {
        from: () => ({
          delete: () => ({
            eq: () => ({
              select: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(404);
    });

    it('should return 400 on PUT if flow ID parameter is not a valid UUID', async () => {
      const req = new Request('http://localhost/functions/v1/api/flows/invalid-uuid-format', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Valid Name' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        'flows/invalid-uuid-format',
        {},
        null,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid or missing flow ID');
    });

    it('should return 400 on PUT if request body schema is malformed', async () => {
      const req = new Request(`http://localhost/functions/v1/api/flows/${validFlowId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_enabled: 'not-a-boolean' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}`,
        {},
        null,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('is_enabled:');
    });

    it('should return 400 on DELETE if flow ID parameter is not a valid UUID', async () => {
      const req = new Request('http://localhost/functions/v1/api/flows/invalid-uuid-format', {
        method: 'DELETE',
      });

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        'flows/invalid-uuid-format',
        {},
        null,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid or missing flow ID');
    });
  });

  describe('/channels endpoints routing', () => {
    const validChannelId = '8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e';
    const validFlowId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

    it('should retrieve channels and mask configuration secrets on GET', async () => {
      const req = new Request('http://localhost/functions/v1/api/channels', {
        method: 'GET',
      });

      const secretKey = getMasterKey();
      const encryptedConfig = await encryptConfig(
        { webhook_url: 'https://hooks.slack.com/services/T123/B456/SECRET' },
        secretKey,
      );

      const mockChannels = [
        {
          id: validChannelId,
          type: 'slack',
          config: encryptedConfig,
        },
      ];

      const mockSupabase = {
        from: () => ({
          select: () => ({
            order: async () => ({ data: mockChannels, error: null }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'channels',
        'channels',
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data[0].config.webhook_url).toBe('https://hooks.slack.com/services/*****');
    });

    it('should create delivery channel with encrypted config on POST', async () => {
      const req = new Request('http://localhost/functions/v1/api/channels', {
        method: 'POST',
        body: JSON.stringify({
          type: 'email',
          config: { email: 'john.doe@gmail.com' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const secretKey = getMasterKey();
      const encryptedConfig = await encryptConfig({ email: 'john.doe@gmail.com' }, secretKey);

      const mockSupabase = {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: validChannelId,
                  type: 'email',
                  config: encryptedConfig,
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'channels',
        'channels',
        mockSupabase,
        null,
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.type).toBe('email');
      expect(json.data.config.email).toBe('j***e@gmail.com');
    });

    it('should block generic webhook target if it fails SSRF validation', async () => {
      const req = new Request('http://localhost/functions/v1/api/channels', {
        method: 'POST',
        body: JSON.stringify({
          type: 'webhook',
          config: { webhook_url: 'http://127.0.0.1/notify' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await handleApiRoute(req, { id: 'user-abc' }, 'channels', 'channels', {}, null);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('resolves to an unsafe private/reserved address range');
    });

    it('should update channel config successfully on PUT', async () => {
      const req = new Request(`http://localhost/functions/v1/api/channels/${validChannelId}`, {
        method: 'PUT',
        body: JSON.stringify({
          type: 'telegram',
          config: { chat_id: '12345', bot_token: '123:abc' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const secretKey = getMasterKey();
      const encryptedConfig = await encryptConfig(
        { chat_id: '12345', bot_token: '123:abc' },
        secretKey,
      );

      const mockSupabase = {
        from: () => ({
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: validChannelId,
                    type: 'telegram',
                    config: encryptedConfig,
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
        { id: 'user-abc' },
        'channels',
        `channels/${validChannelId}`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.config.chat_id).toBe('123*****');
      expect(json.data.config.bot_token).toBe('*****');
    });

    it('should verify channel status to active on POST verify', async () => {
      const req = new Request(
        `http://localhost/functions/v1/api/channels/${validChannelId}/verify`,
        {
          method: 'POST',
        },
      );

      const secretKey = getMasterKey();
      const encryptedConfig = await encryptConfig({ email: 'john.doe@gmail.com' }, secretKey);

      const mockSupabase = {
        from: () => ({
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: validChannelId,
                    type: 'email',
                    status: 'active',
                    config: encryptedConfig,
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
        { id: 'user-abc' },
        'channels',
        `channels/${validChannelId}/verify`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('active');
    });

    it('should delete delivery channel successfully via DELETE', async () => {
      const req = new Request(`http://localhost/functions/v1/api/channels/${validChannelId}`, {
        method: 'DELETE',
      });

      const mockSupabase = {
        from: () => ({
          delete: () => ({
            eq: () => ({
              select: async () => ({ data: [{ id: validChannelId }], error: null }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'channels',
        `channels/${validChannelId}`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
    });

    it('should link channel to flow on POST flows/:id/channels', async () => {
      const req = new Request(`http://localhost/functions/v1/api/flows/${validFlowId}/channels`, {
        method: 'POST',
        body: JSON.stringify({ channel_id: validChannelId }),
        headers: { 'Content-Type': 'application/json' },
      });

      const mockSupabase = {
        from: (table: string) => {
          if (table === 'processing_flows') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: validFlowId }, error: null }),
                }),
              }),
            };
          }
          if (table === 'delivery_channels') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { id: validChannelId }, error: null }),
                }),
              }),
            };
          }
          // flow_delivery_channels
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: { flow_id: validFlowId, channel_id: validChannelId },
                  error: null,
                }),
              }),
            }),
          };
        },
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}/channels`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(201);
    });

    it('should unlink channel from flow on DELETE flows/:id/channels/:channel_id', async () => {
      const req = new Request(
        `http://localhost/functions/v1/api/flows/${validFlowId}/channels/${validChannelId}`,
        {
          method: 'DELETE',
        },
      );

      const mockSupabase = {
        from: () => ({
          delete: () => ({
            eq: () => ({
              eq: () => ({
                select: async () => ({
                  data: [{ flow_id: validFlowId, channel_id: validChannelId }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const res = await handleApiRoute(
        req,
        { id: 'user-abc' },
        'flows',
        `flows/${validFlowId}/channels/${validChannelId}`,
        mockSupabase,
        null,
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.unlinked).toBe(true);
    });
  });
});
