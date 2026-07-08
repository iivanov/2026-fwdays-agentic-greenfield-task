import { z, type ZodIssue } from 'zod';
import {
  type DnsResolver,
  fetchWithSsrfProtection,
  SsrfProtectionError,
  validateUrlSsrf,
} from './ssrf.ts';
import {
  decryptConfig,
  decryptPromptTemplate,
  encryptConfig,
  encryptPromptTemplate,
  getMasterKey,
  maskConfig,
} from './crypto.ts';

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

type ChannelType = 'in-app' | 'email' | 'telegram' | 'slack' | 'webhook';

type AuthenticatedApiUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

type ProcessingFlowRecord = {
  prompt_type?: 'predefined' | 'custom' | string | null;
  prompt_template?: string | null;
  [key: string]: unknown;
};

type DigestFeedbackValue = 'thumbs_up' | 'thumbs_down' | 'none';

type DigestFlowSummary = {
  id: string;
  name: string;
};

type DigestRecord = {
  id: string;
  flow_id: string;
  processing_run_id: string;
  content: unknown;
  token_usage: number;
  provider_request_id: string | null;
  model: string;
  user_feedback: DigestFeedbackValue;
  created_at: string;
};

const feedbackValues = ['thumbs_up', 'thumbs_down', 'none'] as const;

function emptyFeedbackCounts(): Record<DigestFeedbackValue, number> {
  return { thumbs_up: 0, thumbs_down: 0, none: 0 };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function buildDigestReport(digests: DigestRecord[], flows: DigestFlowSummary[]) {
  const flowById = new Map(flows.map((flow) => [flow.id, flow]));
  const counts = emptyFeedbackCounts();

  const items = digests.map((digest) => {
    const feedback = feedbackValues.includes(digest.user_feedback) ? digest.user_feedback : 'none';
    counts[feedback] += 1;
    const flow = flowById.get(digest.flow_id) ?? { id: digest.flow_id, name: 'Unknown flow' };
    return {
      id: digest.id,
      flow_id: digest.flow_id,
      flow_name: flow.name,
      processing_run_id: digest.processing_run_id,
      content: digest.content,
      token_usage: digest.token_usage,
      provider_request_id: digest.provider_request_id,
      model: digest.model,
      user_feedback: feedback,
      created_at: digest.created_at,
    };
  });

  return { digests: items, feedback_counts: counts };
}

async function decryptFlowPrompt<T extends ProcessingFlowRecord>(flow: T): Promise<T> {
  if (flow.prompt_type !== 'custom') {
    return { ...flow, prompt_template: null };
  }
  return { ...flow, prompt_template: await decryptPromptTemplate(flow.prompt_template) };
}

async function decryptFlowPrompts<T extends ProcessingFlowRecord>(
  flows: T[] | null,
): Promise<T[] | null> {
  if (!flows) return flows;
  return await Promise.all(flows.map((flow) => decryptFlowPrompt(flow)));
}

async function buildPromptTemplateForStorage(
  promptType: 'predefined' | 'custom' | undefined,
  promptTemplate: string | null | undefined,
): Promise<string | null | undefined> {
  if (promptType === 'predefined') return null;
  if (promptTemplate === undefined) return undefined;
  if (promptTemplate === null) return null;
  return await encryptPromptTemplate(promptTemplate);
}

function isVerifiedEmailUser(user: AuthenticatedApiUser): user is AuthenticatedApiUser & {
  email: string;
} {
  return Boolean(user.email && (user.email_confirmed_at || user.confirmed_at));
}

function bindDeliveryConfigToIdentity(
  type: ChannelType,
  config: Record<string, unknown>,
  user: AuthenticatedApiUser,
): { success: true; config: Record<string, unknown> } | { success: false; error: string } {
  if (type === 'email') {
    if (!isVerifiedEmailUser(user)) {
      return {
        success: false,
        error: 'Email delivery requires a verified authenticated account email',
      };
    }
    return { success: true, config: { email: user.email } };
  }

  if (type === 'telegram') {
    if ('bot_token' in config) {
      return {
        success: false,
        error: 'Telegram channels use the application-owned bot; do not submit bot tokens',
      };
    }
  }

  return { success: true, config };
}

function getEnv(name: string): string {
  try {
    const globalRecord = globalThis as Record<string, unknown>;
    const anyDeno = globalRecord.Deno as Record<string, unknown> | undefined;
    if (anyDeno && typeof anyDeno.env === 'object' && anyDeno.env !== null) {
      const envRecord = anyDeno.env as Record<string, unknown>;
      if (typeof envRecord.get === 'function') {
        return (envRecord.get(name) as string) || '';
      }
    }
  } catch {
    // ignore
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[name] || '';
    }
  } catch {
    // ignore
  }

  return '';
}

async function fetchWithVerificationTimeout(
  url: string,
  init: RequestInit,
  resolveDns?: DnsResolver,
  timeoutMs = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchWithSsrfProtection(url, { ...init, signal: controller.signal }, {
      resolveDns,
      followRedirects: false,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function deliveryVerificationFailure(
  error: unknown,
  safetyError: string,
  providerError: string,
): { success: false; error: string } {
  if (error instanceof SsrfProtectionError) {
    return { success: false, error: safetyError };
  }

  return { success: false, error: providerError };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signWebhookChallenge(
  secret: string,
  body: string,
  timestamp: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return toHex(new Uint8Array(signature));
}

export async function verifyDeliveryChannelTarget(
  type: ChannelType,
  config: Record<string, unknown>,
  resolveDns?: DnsResolver,
): Promise<{ success: true } | { success: false; error: string }> {
  if (type === 'in-app' || type === 'email') {
    return { success: true };
  }

  if (type === 'telegram') {
    const botToken = getEnv('TELEGRAM_BOT_TOKEN');
    const chatId = config.chat_id;
    if (!botToken) {
      return { success: false, error: 'Telegram verification is unavailable' };
    }
    if (!chatId || typeof chatId !== 'string') {
      return { success: false, error: 'Telegram chat ID is missing' };
    }
    const response = await fetchWithVerificationTimeout(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
      { method: 'GET' },
      resolveDns,
    );
    if (!response.ok) {
      return { success: false, error: 'Telegram chat verification failed' };
    }
    return { success: true };
  }

  if (type === 'slack') {
    const webhookUrl = config.webhook_url;
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return { success: false, error: 'Slack webhook URL is missing' };
    }
    const isSafe = await validateUrlSsrf(webhookUrl, resolveDns);
    if (!isSafe) {
      return { success: false, error: 'Slack webhook URL failed outbound safety validation' };
    }
    let response: Response;
    try {
      response = await fetchWithVerificationTimeout(
        webhookUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'AI News Aggregator delivery channel verification.' }),
        },
        resolveDns,
      );
    } catch (error) {
      return deliveryVerificationFailure(
        error,
        'Slack webhook URL failed outbound safety validation',
        'Slack webhook verification failed',
      );
    }
    if (!response.ok) {
      return { success: false, error: 'Slack webhook verification failed' };
    }
    return { success: true };
  }

  if (type === 'webhook') {
    const webhookUrl = config.webhook_url;
    const signingSecret = config.signing_secret;
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return { success: false, error: 'Webhook URL is missing' };
    }
    if (!signingSecret || typeof signingSecret !== 'string') {
      return { success: false, error: 'Webhook signing secret is missing' };
    }
    const isSafe = await validateUrlSsrf(webhookUrl, resolveDns);
    if (!isSafe) {
      return { success: false, error: 'Webhook URL failed outbound safety validation' };
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      type: 'delivery_channel.verify',
      timestamp,
    });
    const signature = await signWebhookChallenge(signingSecret, body, timestamp);
    let response: Response;
    try {
      response = await fetchWithVerificationTimeout(
        webhookUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-News-Aggregator-Event': 'delivery_channel.verify',
            'X-News-Aggregator-Timestamp': timestamp,
            'X-News-Aggregator-Signature': `sha256=${signature}`,
          },
          body,
        },
        resolveDns,
      );
    } catch (error) {
      return deliveryVerificationFailure(
        error,
        'Webhook URL failed outbound safety validation',
        'Webhook challenge verification failed',
      );
    }
    if (!response.ok) {
      return { success: false, error: 'Webhook challenge verification failed' };
    }
    return { success: true };
  }

  return { success: false, error: 'Unsupported delivery channel type' };
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
  user: AuthenticatedApiUser | null,
  rootSegment: string,
  route: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  resolveDns?: DnsResolver,
): Promise<Response> {
  const segments = route.split('/').filter(Boolean);

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
    const flowId = segments[1] || '';

    if (segments[2] === 'channels') {
      if (
        !flowId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flowId)
      ) {
        return sendError('Invalid or missing flow ID', req, 400);
      }

      if (req.method === 'GET') {
        const { data, error } = await supabaseClient
          .from('flow_delivery_channels')
          .select('channel_id, delivery_channels (*)')
          .eq('flow_id', flowId);

        if (error) {
          return sendError(error.message, req, 500);
        }

        const secretKey = getMasterKey();
        const formatted = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data || []).map(async (link: any) => {
            const chan = link.delivery_channels;
            if (chan) {
              const rawConfig = await decryptConfig(chan.config, secretKey);
              chan.config = maskConfig(chan.type, rawConfig);
            }
            return chan;
          }),
        );

        return sendSuccess(formatted.filter(Boolean), req);
      }

      if (req.method === 'POST') {
        const linkSchema = z.object({
          channel_id: z.string().uuid(),
        });
        const validation = await validateBody(req, linkSchema);
        if (!validation.success) {
          return sendError(validation.error, req, 400);
        }
        const { channel_id } = validation.data;

        // Verify that the flow exists and the user owns it
        const flowCheck = await supabaseClient
          .from('processing_flows')
          .select('id')
          .eq('id', flowId)
          .single();

        if (flowCheck.error) {
          return sendError('Flow not found or unauthorized access', req, 404);
        }

        // Verify that the channel exists and the user owns it
        const chanCheck = await supabaseClient
          .from('delivery_channels')
          .select('id')
          .eq('id', channel_id)
          .single();

        if (chanCheck.error) {
          return sendError('Delivery channel not found or unauthorized access', req, 404);
        }

        const { data, error } = await supabaseClient
          .from('flow_delivery_channels')
          .insert({
            flow_id: flowId,
            channel_id,
          })
          .select()
          .single();

        if (error) {
          return sendError(error.message, req, 500);
        }

        return sendSuccess(data, req, 201);
      }

      if (req.method === 'DELETE') {
        const targetChannelId = segments[3] || '';
        if (
          !targetChannelId ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetChannelId)
        ) {
          return sendError('Invalid or missing channel ID in linkage path', req, 400);
        }

        const { data, error } = await supabaseClient
          .from('flow_delivery_channels')
          .delete()
          .eq('flow_id', flowId)
          .eq('channel_id', targetChannelId)
          .select();

        if (error) {
          return sendError(error.message, req, 500);
        }

        if (!data || data.length === 0) {
          return sendError('Linkage mapping not found or unauthorized access', req, 404);
        }

        return sendSuccess({ unlinked: true }, req);
      }

      return sendError('Method Not Allowed', req, 405);
    }

    if (req.method === 'GET') {
      const flowReader = supabaseAdmin ?? supabaseClient;
      let flowQuery = flowReader
        .from('processing_flows')
        .select(
          'id, name, frequency, ai_model, prompt_type, prompt_template, is_enabled, next_run_at, last_run_at, created_at',
        );
      if (supabaseAdmin) {
        flowQuery = flowQuery.eq('user_id', user.id);
      }
      const { data, error } = await flowQuery.order('created_at', { ascending: true });

      if (error) {
        return sendError(error.message, req, 500);
      }
      return sendSuccess(await decryptFlowPrompts(data), req);
    }

    if (req.method === 'POST') {
      const flowSchema = z.object({
        name: z.string().min(1).max(100),
        prompt_type: z.enum(['predefined', 'custom']),
        prompt_template: z.string().nullable().optional(),
        is_enabled: z.boolean().optional(),
      });

      const validation = await validateBody(req, flowSchema);
      if (!validation.success) {
        return sendError(validation.error, req, 400);
      }

      const { name, prompt_type, prompt_template, is_enabled } = validation.data;
      const promptTemplateForStorage = await buildPromptTemplateForStorage(
        prompt_type,
        prompt_template,
      );

      const flowWriter = supabaseAdmin ?? supabaseClient;
      const { data, error } = await flowWriter
        .from('processing_flows')
        .insert({
          user_id: user.id,
          name,
          prompt_type,
          prompt_template: promptTemplateForStorage ?? null,
          is_enabled: is_enabled !== false,
        })
        .select()
        .single();

      if (error) {
        const msg = error.message || '';
        if (msg.includes('quota') || msg.includes('maximum')) {
          return sendError(msg, req, 400);
        }
        return sendError('Unable to create processing flow', req, 500);
      }

      return sendSuccess(data ? await decryptFlowPrompt(data) : data, req, 201);
    }

    if (req.method === 'PUT') {
      if (
        !flowId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flowId)
      ) {
        return sendError('Invalid or missing flow ID', req, 400);
      }

      const updateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        prompt_type: z.enum(['predefined', 'custom']).optional(),
        prompt_template: z.string().nullable().optional(),
        is_enabled: z.boolean().optional(),
      });

      const validation = await validateBody(req, updateSchema);
      if (!validation.success) {
        return sendError(validation.error, req, 400);
      }

      const updatePayload: Record<string, unknown> = { ...validation.data };
      if ('prompt_type' in validation.data || 'prompt_template' in validation.data) {
        const promptTemplateForStorage = await buildPromptTemplateForStorage(
          validation.data.prompt_type,
          validation.data.prompt_template,
        );
        if (promptTemplateForStorage !== undefined) {
          updatePayload.prompt_template = promptTemplateForStorage;
        }
      }

      const flowWriter = supabaseAdmin ?? supabaseClient;
      let updateQuery = flowWriter.from('processing_flows').update(updatePayload).eq('id', flowId);
      if (supabaseAdmin) {
        updateQuery = updateQuery.eq('user_id', user.id);
      }
      const { data, error } = await updateQuery.select().single();

      if (error) {
        if (error.code === 'PGRST116') {
          return sendError('Flow not found or unauthorized access', req, 404);
        }
        return sendError('Unable to update processing flow', req, 500);
      }

      return sendSuccess(data ? await decryptFlowPrompt(data) : data, req);
    }

    if (req.method === 'DELETE') {
      if (
        !flowId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flowId)
      ) {
        return sendError('Invalid or missing flow ID', req, 400);
      }

      const { data, error } = await supabaseClient
        .from('processing_flows')
        .delete()
        .eq('id', flowId)
        .select();

      if (error) {
        return sendError(error.message, req, 500);
      }

      if (!data || data.length === 0) {
        return sendError('Flow not found or unauthorized access', req, 404);
      }

      return sendSuccess({ deleted: true }, req);
    }

    return sendError('Method Not Allowed', req, 405);
  }

  if (rootSegment === 'digests') {
    const digestId = segments[1] || '';

    if (req.method === 'GET' && !digestId) {
      const reader = supabaseAdmin ?? supabaseClient;
      let flowQuery = reader.from('processing_flows').select('id, name');
      if (supabaseAdmin) {
        flowQuery = flowQuery.eq('user_id', user.id);
      }
      const { data: flows, error: flowError } = await flowQuery.order('created_at', {
        ascending: true,
      });

      if (flowError) {
        return sendError(flowError.message, req, 500);
      }

      const userFlows = (flows ?? []) as DigestFlowSummary[];
      if (userFlows.length === 0) {
        return sendSuccess(buildDigestReport([], []), req);
      }

      const flowIds = userFlows.map((flow) => flow.id);
      const { data: digests, error: digestError } = await reader
        .from('processed_digests')
        .select(
          'id, flow_id, processing_run_id, content, token_usage, provider_request_id, model, user_feedback, created_at',
        )
        .in('flow_id', flowIds)
        .order('created_at', { ascending: false });

      if (digestError) {
        return sendError(digestError.message, req, 500);
      }

      return sendSuccess(buildDigestReport((digests ?? []) as DigestRecord[], userFlows), req);
    }

    if (req.method === 'PUT' && segments[2] === 'feedback') {
      if (!digestId || !isUuid(digestId)) {
        return sendError('Invalid or missing digest ID', req, 400);
      }

      const feedbackSchema = z.object({
        user_feedback: z.enum(feedbackValues),
      });
      const validation = await validateBody(req, feedbackSchema);
      if (!validation.success) {
        return sendError(validation.error, req, 400);
      }

      const writer = supabaseAdmin ?? supabaseClient;
      let flowIds: string[] | null = null;
      if (supabaseAdmin) {
        const { data: flows, error: flowError } = await writer
          .from('processing_flows')
          .select('id')
          .eq('user_id', user.id);
        if (flowError) {
          return sendError(flowError.message, req, 500);
        }
        flowIds = ((flows ?? []) as Array<{ id: string }>).map((flow) => flow.id);
        if (flowIds.length === 0) {
          return sendError('Digest not found or unauthorized access', req, 404);
        }
      }

      let updateQuery = writer
        .from('processed_digests')
        .update({ user_feedback: validation.data.user_feedback })
        .eq('id', digestId);
      if (flowIds) {
        updateQuery = updateQuery.in('flow_id', flowIds);
      }

      const { data, error } = await updateQuery
        .select('id, flow_id, user_feedback, created_at')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return sendError('Digest not found or unauthorized access', req, 404);
        }
        return sendError(error.message, req, 500);
      }

      return sendSuccess(data, req);
    }

    return sendError('Method Not Allowed', req, 405);
  }

  if (rootSegment === 'channels') {
    const channelId = segments[1] || '';

    // Verify sub-route: POST /channels/:id/verify
    if (req.method === 'POST' && segments[2] === 'verify') {
      if (
        !channelId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId)
      ) {
        return sendError('Invalid or missing channel ID', req, 400);
      }

      const channelRead = await supabaseClient
        .from('delivery_channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (channelRead.error) {
        if (channelRead.error.code === 'PGRST116') {
          return sendError('Delivery channel not found or unauthorized access', req, 404);
        }
        return sendError(channelRead.error.message, req, 500);
      }

      const secretKey = getMasterKey();
      const rawConfig = await decryptConfig(channelRead.data.config, secretKey);
      const verification = await verifyDeliveryChannelTarget(
        channelRead.data.type,
        rawConfig,
        resolveDns,
      );
      if (!verification.success) {
        return sendError(verification.error, req, 400);
      }

      const channelActivator = supabaseAdmin ?? supabaseClient;
      let activationQuery = channelActivator
        .from('delivery_channels')
        .update({
          status: 'active',
          verified_at: new Date().toISOString(),
        })
        .eq('id', channelId);
      if (supabaseAdmin) {
        activationQuery = activationQuery.eq('user_id', user.id);
      }
      const { data, error } = await activationQuery.select().single();

      if (error) {
        if (error.code === 'PGRST116') {
          return sendError('Delivery channel not found or unauthorized access', req, 404);
        }
        return sendError(error.message, req, 500);
      }

      data.config = maskConfig(data.type, rawConfig);

      return sendSuccess(data, req);
    }

    if (req.method === 'GET') {
      // If we have an ID but not verify, let's treat it as not found / method not allowed or simply return that channel if needed.
      // But standard GET is for listing all channels. Let's return list:
      if (channelId) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId)) {
          return sendError('Invalid channel ID format', req, 400);
        }
        const { data, error } = await supabaseClient
          .from('delivery_channels')
          .select('*')
          .eq('id', channelId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return sendError('Delivery channel not found or unauthorized access', req, 404);
          }
          return sendError(error.message, req, 500);
        }

        const secretKey = getMasterKey();
        const rawConfig = await decryptConfig(data.config, secretKey);
        data.config = maskConfig(data.type, rawConfig);
        return sendSuccess(data, req);
      }

      const { data, error } = await supabaseClient
        .from('delivery_channels')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        return sendError(error.message, req, 500);
      }

      const secretKey = getMasterKey();
      const decryptedData = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data || []).map(async (channel: any) => {
          const rawConfig = await decryptConfig(channel.config, secretKey);
          channel.config = maskConfig(channel.type, rawConfig);
          return channel;
        }),
      );

      return sendSuccess(decryptedData, req);
    }

    if (req.method === 'POST') {
      const createSchema = z.object({
        type: z.enum(['in-app', 'email', 'telegram', 'slack', 'webhook']),
        config: z.record(z.any()),
      });
      const validation = await validateBody(req, createSchema);
      if (!validation.success) {
        return sendError(validation.error, req, 400);
      }
      const { type, config: submittedConfig } = validation.data as {
        type: ChannelType;
        config: Record<string, unknown>;
      };
      const boundConfig = bindDeliveryConfigToIdentity(type, submittedConfig, user);
      if (!boundConfig.success) {
        return sendError(boundConfig.error, req, 400);
      }
      const config = boundConfig.config;

      const configVal = validateChannelConfig(type, config);
      if (!configVal.success) {
        return sendError(configVal.error || 'Invalid config parameters', req, 400);
      }

      let revealGeneratedSigningSecret = false;
      if (type === 'webhook') {
        const webhookUrl = config.webhook_url;
        if (typeof webhookUrl !== 'string') {
          return sendError('Config must contain webhook_url string', req, 400);
        }
        const isSafe = await validateUrlSsrf(webhookUrl, resolveDns);
        if (!isSafe) {
          return sendError(
            'Webhook URL target resolves to an unsafe private/reserved address range',
            req,
            400,
          );
        }
        if (!config.signing_secret) {
          config.signing_secret = generateSigningSecret();
          revealGeneratedSigningSecret = true;
        }
      }

      const secretKey = getMasterKey();
      const encryptedConfig = await encryptConfig(config, secretKey);

      const { data, error } = await supabaseClient
        .from('delivery_channels')
        .insert({
          user_id: user.id,
          type,
          config: encryptedConfig,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        return sendError(error.message, req, 500);
      }

      const rawConfig = await decryptConfig(data.config, secretKey);
      data.config = revealGeneratedSigningSecret && data.type === 'webhook'
        ? { ...maskConfig(data.type, rawConfig), signing_secret: rawConfig.signing_secret }
        : maskConfig(data.type, rawConfig);

      return sendSuccess(data, req, 201);
    }

    if (req.method === 'PUT') {
      if (
        !channelId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId)
      ) {
        return sendError('Invalid or missing channel ID', req, 400);
      }

      const updateSchema = z.object({
        type: z.enum(['in-app', 'email', 'telegram', 'slack', 'webhook']),
        config: z.record(z.any()),
      });
      const validation = await validateBody(req, updateSchema);
      if (!validation.success) {
        return sendError(validation.error, req, 400);
      }
      const { type, config: submittedConfig } = validation.data as {
        type: ChannelType;
        config: Record<string, unknown>;
      };
      const boundConfig = bindDeliveryConfigToIdentity(type, submittedConfig, user);
      if (!boundConfig.success) {
        return sendError(boundConfig.error, req, 400);
      }
      const config = boundConfig.config;

      const configVal = validateChannelConfig(type, config);
      if (!configVal.success) {
        return sendError(configVal.error || 'Invalid config parameters', req, 400);
      }

      let revealGeneratedSigningSecret = false;
      if (type === 'webhook') {
        const existingChannel = await supabaseClient
          .from('delivery_channels')
          .select('config')
          .eq('id', channelId)
          .single();
        if (existingChannel.error) {
          if (existingChannel.error.code === 'PGRST116') {
            return sendError('Delivery channel not found or unauthorized access', req, 404);
          }
          return sendError(existingChannel.error.message, req, 500);
        }

        const existingConfig = await decryptConfig(existingChannel.data.config, getMasterKey());
        if (
          !config.signing_secret &&
          existingConfig &&
          typeof existingConfig === 'object' &&
          typeof existingConfig.signing_secret === 'string'
        ) {
          config.signing_secret = existingConfig.signing_secret;
        }

        const webhookUrl = config.webhook_url;
        if (typeof webhookUrl !== 'string') {
          return sendError('Config must contain webhook_url string', req, 400);
        }
        const isSafe = await validateUrlSsrf(webhookUrl, resolveDns);
        if (!isSafe) {
          return sendError(
            'Webhook URL target resolves to an unsafe private/reserved address range',
            req,
            400,
          );
        }
        if (!config.signing_secret) {
          config.signing_secret = generateSigningSecret();
          revealGeneratedSigningSecret = true;
        }
      }

      const secretKey = getMasterKey();
      const encryptedConfig = await encryptConfig(config, secretKey);

      const { data, error } = await supabaseClient
        .from('delivery_channels')
        .update({
          type,
          config: encryptedConfig,
        })
        .eq('id', channelId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return sendError('Delivery channel not found or unauthorized access', req, 404);
        }
        return sendError(error.message, req, 500);
      }

      const rawConfig = await decryptConfig(data.config, secretKey);
      data.config = revealGeneratedSigningSecret && data.type === 'webhook'
        ? { ...maskConfig(data.type, rawConfig), signing_secret: rawConfig.signing_secret }
        : maskConfig(data.type, rawConfig);

      return sendSuccess(data, req);
    }

    if (req.method === 'DELETE') {
      if (
        !channelId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId)
      ) {
        return sendError('Invalid or missing channel ID', req, 400);
      }

      const { data, error } = await supabaseClient
        .from('delivery_channels')
        .delete()
        .eq('id', channelId)
        .select();

      if (error) {
        return sendError(error.message, req, 500);
      }

      if (!data || data.length === 0) {
        return sendError('Delivery channel not found or unauthorized access', req, 404);
      }

      return sendSuccess({ deleted: true }, req);
    }

    return sendError('Method Not Allowed', req, 405);
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
  } else if (route.startsWith('/api/')) {
    route = route.slice('/api/'.length);
  } else if (route === '/api') {
    route = '';
  }

  const segments = route.split('/').filter(Boolean);
  const rootSegment = segments[0] || '';

  // Health check route is public (does not require JWT or auth client calls)
  if (rootSegment === 'health' || rootSegment === '') {
    return sendSuccess({ status: 'healthy', timestamp: new Date().toISOString() }, req);
  }

  // Authenticate request using user JWT
  let user: AuthenticatedApiUser | null = null;
  try {
    const { data, error } = await ctx.supabase.auth.getUser();
    if (!error && data?.user) {
      user = {
        id: data.user.id,
        email: data.user.email,
        email_confirmed_at: data.user.email_confirmed_at,
        confirmed_at: data.user.confirmed_at,
      };
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

// -----------------------------------------------------------------------------
// Delivery Channels Helper Functions
// -----------------------------------------------------------------------------

export function generateSigningSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function validateChannelConfig(
  type: string,
  config: Record<string, unknown>,
): { success: boolean; error?: string } {
  if (!config || typeof config !== 'object') {
    return { success: false, error: 'Config must be an object' };
  }

  if (type === 'email') {
    const email = config.email;
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return { success: false, error: 'Config must contain a valid email address' };
    }
  } else if (type === 'telegram') {
    if (!config.chat_id || typeof config.chat_id !== 'string') {
      return { success: false, error: 'Config must contain chat_id string' };
    }
    if ('bot_token' in config) {
      return {
        success: false,
        error: 'Config must not contain bot_token; Telegram uses the application-owned bot',
      };
    }
  } else if (type === 'slack') {
    const url = config.webhook_url;
    if (!url || typeof url !== 'string' || !/^https:\/\/hooks\.slack\.com\/services\//.test(url)) {
      return { success: false, error: 'Config must contain a valid Slack webhook URL' };
    }
  } else if (type === 'webhook') {
    const url = config.webhook_url;
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Config must contain webhook_url string' };
    }
    try {
      new URL(url);
    } catch {
      return { success: false, error: 'Invalid webhook URL format' };
    }
  }

  return { success: true };
}
