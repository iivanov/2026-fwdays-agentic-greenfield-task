import { describe, expect, it } from 'vitest';
import { createWorkHandler, deliverAttempt } from '../../../../supabase/functions/work/index.ts';

const SERVICE_KEY = 'test-service-key';
const ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
const DIGEST_ID = '22222222-2222-4222-8222-222222222222';
const CHANNEL_ID = '33333333-3333-4333-8333-333333333333';
const FLOW_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '55555555-5555-4555-8555-555555555555';
const SIGNING_SECRET = 'a'.repeat(64);

type ChannelType = 'in-app' | 'email' | 'telegram' | 'slack' | 'webhook';
type Row = Record<string, unknown>;
type RpcCall = { name: string; args?: Record<string, unknown> };

const digestContent = {
  title: 'Daily Digest',
  language: 'en',
  sections: [
    {
      heading: 'Top Stories',
      items: [
        {
          title: 'Queue workers now deliver',
          summary: 'Delivery adapters send generated digests.',
          source_urls: ['https://example.com/news'],
        },
      ],
    },
  ],
};

const hmacSha256Hex = async (secret: string, value: string): Promise<string> => {
  const bytes = new Uint8Array(secret.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(secret.slice(index * 2, index * 2 + 2), 16);
  }
  const key = await crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const makeQuery = (rows: Row[]) => {
  const predicates: Record<string, unknown> = {};
  const filteredRows = () =>
    rows.filter((row) =>
      Object.entries(predicates).every(([column, value]) => row[column] === value),
    );
  const builder = {
    eq: (column: string, value: string) => {
      predicates[column] = value;
      return builder;
    },
    limit: () => builder,
    maybeSingle: async () => ({ data: filteredRows()[0] ?? null, error: null }),
    then: (resolve: (value: { data?: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: filteredRows(), error: null })),
  };
  return builder;
};

const makeDeliveryClient = (
  channelType: ChannelType,
  config: Row,
  rpcOverrides: Record<
    string,
    (args?: Record<string, unknown>) => { data: unknown; error: null }
  > = {},
) => {
  const rpcCalls: RpcCall[] = [];
  const tables: Record<string, Row[]> = {
    digest_delivery_attempts: [
      {
        id: ATTEMPT_ID,
        digest_id: DIGEST_ID,
        channel_id: CHANNEL_ID,
        status: 'pending',
      },
    ],
    delivery_channels: [
      {
        id: CHANNEL_ID,
        user_id: USER_ID,
        type: channelType,
        status: 'active',
        config,
      },
    ],
    processed_digests: [{ id: DIGEST_ID, flow_id: FLOW_ID, content: digestContent }],
    processing_flows: [{ id: FLOW_ID, name: 'Engineering Daily' }],
  };

  return {
    rpcCalls,
    rpc: async (name: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (rpcOverrides[name]) return rpcOverrides[name](args);
      if (name === 'claim_delivery_attempt') {
        return { data: { claimed: true, status: 'sending' }, error: null };
      }
      if (name === 'claim_integration_circuit_probe') {
        return { data: { allowed: true, state: 'closed' }, error: null };
      }
      if (name === 'claim_job') {
        return {
          data:
            args?.queue_name === 'delivery-queue'
              ? [
                  {
                    msg_id: 77,
                    read_ct: 1,
                    enqueued_at: new Date().toISOString(),
                    message: { type: 'delivery', attempt_id: ATTEMPT_ID },
                  },
                ]
              : [],
          error: null,
        };
      }
      if (name === 'record_delivery_failure_worker_job') {
        return { data: { acknowledged: true }, error: null };
      }
      if (name === 'complete_delivery_worker_job') {
        return { data: { acknowledged: true }, error: null };
      }
      if (name === 'acknowledge_delivery_worker_job') {
        return { data: { acknowledged: true }, error: null };
      }
      if (name === 'requeue_delivery_worker_job') {
        return { data: { acknowledged: true, requeued_msg_id: 88 }, error: null };
      }
      return { data: {}, error: null };
    },
    from: (table: string) => ({
      select: () => makeQuery(tables[table] ?? []),
      update: () => {
        const builder = {
          eq: () => builder,
          then: (resolve: (value: { error: null }) => unknown) =>
            Promise.resolve(resolve({ error: null })),
        };
        return builder;
      },
    }),
  };
};

describe('R-14 delivery worker', () => {
  it('sends Brevo email to the verified channel recipient', async () => {
    const client = makeDeliveryClient('email', { email: 'user@example.com' });
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response('{}', { status: 201 });
    };

    await deliverAttempt(client, ATTEMPT_ID, {
      fetchImpl,
      brevoApiKey: 'brevo-key',
      brevoSenderEmail: 'sender@example.com',
    });

    expect(requests[0]?.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((requests[0]?.init?.headers as Record<string, string>)['api-key']).toBe('brevo-key');
    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      sender: { email: 'sender@example.com' },
      to: [{ email: 'user@example.com' }],
      subject: 'Daily Digest',
    });
  });

  it('sends Telegram digests through the documented raw bot-token path', async () => {
    const client = makeDeliveryClient('telegram', { chat_id: '-1001234567890' });
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    await deliverAttempt(client, ATTEMPT_ID, {
      fetchImpl,
      telegramBotToken: '123456:app-owned-token',
    });

    expect(requests[0]?.url).toBe('https://api.telegram.org/bot123456:app-owned-token/sendMessage');
    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      chat_id: '-1001234567890',
      text: expect.stringContaining('Daily Digest'),
      disable_web_page_preview: true,
    });
  });

  it('posts generic webhook payloads with stable event id and HMAC signature', async () => {
    const client = makeDeliveryClient('webhook', {
      webhook_url: 'https://hooks.example.com/digest',
      signing_secret: SIGNING_SECRET,
    });
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(null, { status: 204 });
    };

    await deliverAttempt(client, ATTEMPT_ID, {
      fetchImpl,
      resolveDns: async () => ['93.184.216.34'],
      now: () => new Date('2026-07-04T12:00:00.000Z'),
    });

    const headers = requests[0]?.init?.headers as Record<string, string>;
    const rawBody = String(requests[0]?.init?.body);
    const timestamp = '1783166400';
    expect(requests[0]?.url).toBe('https://hooks.example.com/digest');
    expect(headers['X-News-Event-Id']).toBe(ATTEMPT_ID);
    expect(headers['X-News-Timestamp']).toBe(timestamp);
    expect(headers['X-News-Signature']).toBe(
      `v1=${await hmacSha256Hex(SIGNING_SECRET, `${timestamp}.${rawBody}`)}`,
    );
    expect(JSON.parse(rawBody)).toMatchObject({
      schema_version: 1,
      event_id: ATTEMPT_ID,
      digest: { id: DIGEST_ID },
      flow: { id: FLOW_ID, name: 'Engineering Daily' },
    });
  });

  it('blocks Slack redirects instead of following them', async () => {
    const client = makeDeliveryClient('slack', {
      webhook_url: 'https://hooks.slack.com/services/T/B/C',
    });
    const fetchImpl = async () =>
      new Response('', {
        status: 302,
        headers: { location: 'https://example.com/redirected' },
      });

    await expect(
      deliverAttempt(client, ATTEMPT_ID, {
        fetchImpl,
        resolveDns: async () => ['3.33.152.147'],
      }),
    ).rejects.toThrow('slack_redirect_blocked');
  });

  it('acknowledges permanent webhook failures through the delivery failure RPC', async () => {
    const client = makeDeliveryClient('webhook', {
      webhook_url: 'https://hooks.example.com/digest',
      signing_secret: SIGNING_SECRET,
    });
    const handler = createWorkHandler(() => client, {
      delivery: {
        fetchImpl: async () => new Response('{}', { status: 400 }),
        resolveDns: async () => ['93.184.216.34'],
      },
    });

    const response = await handler(
      new Request('http://localhost/functions/v1/work', {
        headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      {
        SUPABASE_URL: 'http://localhost',
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'delivery_failed_permanent',
      error: 'webhook_http_400',
    });
    expect(client.rpcCalls).toContainEqual({
      name: 'record_delivery_failure_worker_job',
      args: expect.objectContaining({
        p_retryable: false,
        p_error_message: 'webhook_http_400',
      }),
    });
  });

  it('acknowledges duplicate jobs for already-delivered attempts without failing the attempt', async () => {
    const client = makeDeliveryClient(
      'in-app',
      {},
      {
        claim_delivery_attempt: () => ({
          data: { claimed: false, status: 'delivered' },
          error: null,
        }),
      },
    );
    const handler = createWorkHandler(() => client);

    const response = await handler(
      new Request('http://localhost/functions/v1/work', {
        headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      {
        SUPABASE_URL: 'http://localhost',
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'completed',
      error: 'delivery_already_completed',
    });
    expect(client.rpcCalls.map((call) => call.name)).toContain('acknowledge_delivery_worker_job');
    expect(client.rpcCalls.map((call) => call.name)).not.toContain(
      'record_delivery_failure_worker_job',
    );
  });

  it('requeues not-yet-due attempts without incrementing failure counters', async () => {
    const client = makeDeliveryClient(
      'in-app',
      {},
      {
        claim_delivery_attempt: () => ({
          data: {
            claimed: false,
            status: 'failed',
            next_attempt_at: new Date(Date.now() + 600_000).toISOString(),
          },
          error: null,
        }),
      },
    );
    const handler = createWorkHandler(() => client);

    const response = await handler(
      new Request('http://localhost/functions/v1/work', {
        headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      {
        SUPABASE_URL: 'http://localhost',
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'delivery_requeued',
      error: 'delivery_not_due',
    });
    expect(client.rpcCalls).toContainEqual({
      name: 'requeue_delivery_worker_job',
      args: expect.objectContaining({
        p_attempt_id: ATTEMPT_ID,
        p_delay_seconds: expect.any(Number),
      }),
    });
    expect(client.rpcCalls.map((call) => call.name)).not.toContain(
      'record_delivery_failure_worker_job',
    );
  });

  it('records transport failures as retryable with circuit scope', async () => {
    const client = makeDeliveryClient('webhook', {
      webhook_url: 'https://hooks.example.com/digest',
      signing_secret: SIGNING_SECRET,
    });
    const handler = createWorkHandler(() => client, {
      delivery: {
        fetchImpl: async () => {
          throw new TypeError('network down');
        },
        resolveDns: async () => ['93.184.216.34'],
      },
    });

    const response = await handler(
      new Request('http://localhost/functions/v1/work', {
        headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      }),
      {
        SUPABASE_URL: 'http://localhost',
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      status: 'failed',
      error: 'delivery_transport_failed',
    });
    expect(client.rpcCalls).toContainEqual({
      name: 'record_delivery_failure_worker_job',
      args: expect.objectContaining({
        p_retryable: true,
        p_error_message: 'delivery_transport_failed',
        p_circuit_scope_type: 'webhook_origin',
        p_circuit_scope_key: expect.any(String),
      }),
    });
  });
});
