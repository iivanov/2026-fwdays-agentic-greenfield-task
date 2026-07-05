import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createWorkHandler } from '../../../../supabase/functions/work/index.ts';

const SERVICE_KEY = 'test-service-key';
const AUTH_REQ = new Request('http://localhost/functions/v1/work', {
  headers: { Authorization: `Bearer ${SERVICE_KEY}` },
});

const migrationSource = readFileSync(
  'supabase/migrations/20260703230000_r11f_queue_transactional_ack.sql',
  'utf8',
);
const schedulerMigrationSource = readFileSync(
  'supabase/migrations/20260703000000_scheduler_queue.sql',
  'utf8',
);
const r13MigrationSource = readFileSync(
  'supabase/migrations/20260704165230_r13_preserve_processing_no_content.sql',
  'utf8',
);
const r14MigrationSource = readFileSync(
  'supabase/migrations/20260704183308_r14_delivery_workers.sql',
  'utf8',
);
const r11gCleanupMigrationSource = readFileSync(
  'supabase/migrations/20260704104026_r11g_retention_metadata_lifecycle.sql',
  'utf8',
);
const allMigrationSources = readdirSync('supabase/migrations')
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) => readFileSync(`supabase/migrations/${fileName}`, 'utf8'))
  .join('\n');
const workFunctionSource = readFileSync('supabase/functions/work/index.ts', 'utf8');

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcCall = { name: string; args?: Record<string, unknown> };

const makeClient = (
  responses: Record<string, RpcResult | ((args?: Record<string, unknown>) => RpcResult)>,
) => {
  const calls: RpcCall[] = [];
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
  const tables: Record<string, Record<string, unknown>[]> = {
    digest_delivery_attempts: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        digest_id: '22222222-2222-2222-2222-222222222222',
        channel_id: '33333333-3333-3333-3333-333333333333',
        status: 'pending',
      },
    ],
    delivery_channels: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        user_id: '44444444-4444-4444-4444-444444444444',
        type: 'in-app',
        status: 'active',
        config: {},
      },
    ],
    processed_digests: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        flow_id: '55555555-5555-5555-5555-555555555555',
        content: { title: 'Digest', language: 'en', sections: [] },
      },
    ],
    processing_flows: [
      {
        id: '55555555-5555-5555-5555-555555555555',
        name: 'Daily Digest',
      },
    ],
  };
  const client = {
    calls,
    updates,
    rpc: async (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      const response = responses[name];
      if (typeof response === 'function') return response(args);
      if (response) return response;
      return { data: {}, error: null };
    },
    from: (table: string) => ({
      select: () => {
        const predicates: Record<string, unknown> = {};
        const builder = {
          eq: (column: string, value: string) => {
            predicates[column] = value;
            return builder;
          },
          limit: () => builder,
          maybeSingle: async () => ({
            data:
              (tables[table] ?? []).find((row) =>
                Object.entries(predicates).every(([column, value]) => row[column] === value),
              ) ?? null,
            error: null,
          }),
          then: (resolve: (value: { data?: unknown; error: null }) => void) =>
            resolve({ data: tables[table] ?? [], error: null }),
        };
        return builder;
      },
      update: (patch: Record<string, unknown>) => {
        updates.push({ table, patch });
        const builder = {
          eq: () => builder,
          then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
        };
        return builder;
      },
    }),
  };
  return client;
};

describe('R-11F queue worker safeguards', () => {
  it('returns an acknowledgement failure when the transactional completion RPC fails', async () => {
    const fakeClient = makeClient({
      claim_job: ({ queue_name }) => ({
        data:
          queue_name === 'delivery-queue'
            ? [
                {
                  msg_id: 42,
                  read_ct: 1,
                  enqueued_at: new Date().toISOString(),
                  message: { type: 'delivery', attempt_id: '11111111-1111-1111-1111-111111111111' },
                },
              ]
            : [],
        error: null,
      }),
      claim_delivery_attempt: { data: { claimed: true, status: 'sending' }, error: null },
      complete_delivery_worker_job: {
        data: null,
        error: { message: 'Queue acknowledgement failed' },
      },
    });
    const handler = createWorkHandler(() => fakeClient);

    const response = await handler(AUTH_REQ, {
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      status: 'failed',
      error: 'complete delivery worker job failed: Queue acknowledgement failed',
    });
    expect(fakeClient.calls.map((call) => call.name)).toContain('complete_delivery_worker_job');
    expect(fakeClient.calls.map((call) => call.name)).not.toContain(
      'record_delivery_failure_worker_job',
    );
  });

  it('fails closed on claim_job RPC errors', async () => {
    const fakeClient = makeClient({
      claim_job: { data: null, error: { message: 'database unavailable' } },
    });
    const handler = createWorkHandler(() => fakeClient);

    const response = await handler(AUTH_REQ, {
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      status: 'claim_failed',
      error: 'database unavailable',
    });
  });

  it('archives exhausted messages before ordinary execution', async () => {
    const exhaustedMessage = {
      type: 'ingestion',
      source_id: '22222222-2222-2222-2222-222222222222',
      flow_id: '55555555-5555-5555-5555-555555555555',
      attempt_id: '11111111-1111-1111-1111-111111111111',
      cycle_date: '2031-03-04',
      simulate_failure: true,
      article_body: 'raw article content must not be persisted in DLQ context',
      digest_text: 'digest text must not be persisted in DLQ context',
      prompt_template: 'private prompt must not be persisted in DLQ context',
      credential: 'secret-token',
    };
    const fakeClient = makeClient({
      claim_job: {
        data: [
          {
            msg_id: 99,
            read_ct: 6,
            enqueued_at: new Date().toISOString(),
            message: exhaustedMessage,
          },
        ],
        error: null,
      },
      archive_exhausted_worker_job: { data: { archived: true }, error: null },
    });
    const handler = createWorkHandler(() => fakeClient);

    const response = await handler(AUTH_REQ, {
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'dlq_archived', msg_id: 99 });
    expect(fakeClient.calls.map((call) => call.name)).toEqual([
      'claim_job',
      'archive_exhausted_worker_job',
    ]);
    expect(fakeClient.calls[1].args).toEqual({
      p_queue_name: 'delivery-queue',
      p_msg_id: 99,
      p_event_key: 'msg_failed_dlq_delivery-queue_99',
      p_context: {
        queue: 'delivery-queue',
        type: 'ingestion',
        source_id: '22222222-2222-2222-2222-222222222222',
        flow_id: '55555555-5555-5555-5555-555555555555',
        attempt_id: '11111111-1111-1111-1111-111111111111',
        cycle_date: '2031-03-04',
      },
    });
    expect(fakeClient.updates).toEqual([]);
  });

  it('emits sanitized correlated logs and deduplicated operator alerts for exhausted work', async () => {
    const sentAlerts: Array<{ url: string; init?: RequestInit }> = [];
    const logs: string[] = [];
    const fakeClient = makeClient({
      claim_job: {
        data: [
          {
            msg_id: 100,
            read_ct: 6,
            enqueued_at: new Date().toISOString(),
            message: {
              type: 'processing',
              flow_id: '55555555-5555-5555-5555-555555555555',
              cycle_date: '2031-03-04',
              digest_text: 'digest text must not be logged',
              prompt_template: 'private prompt must not be logged',
              credential: 'secret-token',
            },
          },
        ],
        error: null,
      },
      archive_exhausted_worker_job: {
        data: { archived: true, event_id: '66666666-6666-4666-8666-666666666666' },
        error: null,
      },
      claim_operational_event_alert: {
        data: {
          claimed: true,
          event_id: '66666666-6666-4666-8666-666666666666',
          severity: 'critical',
          category: 'dlq_exhaustion',
          deduplication_key: 'msg_failed_dlq_processing-queue_100',
          occurrence_count: 1,
          context: {
            queue: 'processing-queue',
            type: 'processing',
            flow_id: '55555555-5555-5555-5555-555555555555',
            cycle_date: '2031-03-04',
          },
        },
        error: null,
      },
    });
    const handler = createWorkHandler(() => fakeClient, {
      logger: {
        log: (message?: unknown) => logs.push(String(message)),
        warn: (message?: unknown) => logs.push(String(message)),
        error: (message?: unknown) => logs.push(String(message)),
      },
      delivery: {
        fetchImpl: async (input, init) => {
          sentAlerts.push({ url: String(input), init });
          return new Response('{}', { status: 201 });
        },
      },
    });

    const response = await handler(
      new Request('http://localhost/functions/v1/work', {
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          'X-Request-Id': 'req-r17',
        },
      }),
      {
        SUPABASE_URL: 'http://localhost',
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        BREVO_API_KEY: 'brevo-key',
        BREVO_SENDER_EMAIL: 'sender@example.com',
        OPERATOR_ALERT_EMAIL: 'operator@example.com',
      },
    );

    expect(response.status).toBe(200);
    expect(sentAlerts).toHaveLength(1);
    expect(sentAlerts[0].url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((sentAlerts[0].init?.headers as Record<string, string>)['api-key']).toBe('brevo-key');
    expect(JSON.parse(String(sentAlerts[0].init?.body))).toMatchObject({
      sender: { email: 'sender@example.com' },
      to: [{ email: 'operator@example.com' }],
      subject: '[News Aggregator] critical dlq_exhaustion',
    });
    expect(fakeClient.calls).toContainEqual({
      name: 'claim_operational_event_alert',
      args: {
        p_event_id: '66666666-6666-4666-8666-666666666666',
        p_cooldown: '1 hour',
      },
    });
    const joinedLogs = logs.join('\n');
    expect(joinedLogs).toContain('"correlation_id":"req-r17"');
    expect(joinedLogs).toContain('"event":"work.dlq_archived"');
    expect(joinedLogs).toContain('"flow_id":"55555555-5555-5555-5555-555555555555"');
    expect(joinedLogs).not.toContain('digest text must not be logged');
    expect(joinedLogs).not.toContain('private prompt must not be logged');
    expect(joinedLogs).not.toContain('secret-token');
  });

  it('logs alert claim failures without blocking exhausted work archival', async () => {
    const logs: string[] = [];
    const fakeClient = makeClient({
      claim_job: {
        data: [
          {
            msg_id: 101,
            read_ct: 6,
            enqueued_at: new Date().toISOString(),
            message: {
              type: 'processing',
              flow_id: '55555555-5555-5555-5555-555555555555',
              cycle_date: '2031-03-04',
            },
          },
        ],
        error: null,
      },
      archive_exhausted_worker_job: {
        data: { archived: true, event_id: '77777777-7777-4777-8777-777777777777' },
        error: null,
      },
      claim_operational_event_alert: {
        data: null,
        error: { message: 'database temporarily unavailable' },
      },
    });
    const handler = createWorkHandler(() => fakeClient, {
      logger: {
        log: (message?: unknown) => logs.push(String(message)),
        warn: (message?: unknown) => logs.push(String(message)),
        error: (message?: unknown) => logs.push(String(message)),
      },
    });

    const response = await handler(
      new Request('http://localhost/functions/v1/work', {
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          'X-Request-Id': 'req-r17-claim-failed',
        },
      }),
      {
        SUPABASE_URL: 'http://localhost',
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
        BREVO_API_KEY: 'brevo-key',
        BREVO_SENDER_EMAIL: 'sender@example.com',
        OPERATOR_ALERT_EMAIL: 'operator@example.com',
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'dlq_archived', msg_id: 101 });
    expect(fakeClient.calls.map((call) => call.name)).toEqual([
      'claim_job',
      'archive_exhausted_worker_job',
      'claim_operational_event_alert',
    ]);
    const joinedLogs = logs.join('\n');
    expect(joinedLogs).toContain('"event":"operator_alert.claim_failed"');
    expect(joinedLogs).toContain('"correlation_id":"req-r17-claim-failed"');
    expect(joinedLogs).toContain('"event_id":"77777777-7777-4777-8777-777777777777"');
    expect(joinedLogs).not.toContain('brevo-key');
  });

  it('requires SQL helpers to raise when pgmq delete or archive returns false', () => {
    expect(migrationSource).toContain('deleted := pgmq.delete(p_queue_name, p_msg_id);');
    expect(migrationSource).toContain('if deleted is not true then');
    expect(migrationSource).toContain('Queue acknowledgement failed');
    expect(migrationSource).toContain('archived := pgmq.archive(p_queue_name, p_msg_id);');
    expect(migrationSource).toContain('if archived is not true then');
    expect(migrationSource).toContain('Queue archive failed');
    expect(migrationSource).toContain("set status = 'delivered'");
    expect(migrationSource).toContain(
      "set status = 'failed', error_message = left(p_error_message, 500)",
    );
  });

  it('keeps legacy queue helper RPCs restricted to known worker queues', () => {
    for (const helperName of ['claim_job', 'delete_job', 'archive_job', 'send_to_queue']) {
      expect(schedulerMigrationSource).toContain(`function public.${helperName}`);
    }
    expect(schedulerMigrationSource).toContain(
      "queue_name not in ('ingestion-queue', 'processing-queue', 'delivery-queue')",
    );
    expect(schedulerMigrationSource).toContain("raise exception 'Unsupported queue name: %'");
    expect(schedulerMigrationSource).toContain("errcode = 'invalid_parameter_value'");
  });

  it('enqueues processing jobs only after all flow sources are terminal', () => {
    expect(r13MigrationSource).toContain(
      'add column if not exists processing_enqueued_at timestamp with time zone',
    );
    expect(r13MigrationSource).toContain('function public.enqueue_ready_processing_runs');
    expect(r13MigrationSource).toContain(
      'perform public.enqueue_ready_processing_runs(p_source_id, p_cycle_date)',
    );
    expect(r13MigrationSource).toContain("perform pgmq.send(\n      'processing-queue'");
    expect(r13MigrationSource).toContain("'type', 'processing'");
    expect(r13MigrationSource).toContain("'flow_id', processing_rec.flow_id");
    expect(r13MigrationSource).toContain("'cycle_date', processing_rec.cycle_date");
    expect(r13MigrationSource).toContain('pr.processing_enqueued_at is null');
    expect(r13MigrationSource).toContain(
      "coalesce(sfr.status, 'pending') not in ('completed', 'failed')",
    );
    expect(r13MigrationSource).toContain('for update of pr skip locked');
  });

  it('runs the processing handoff when ingestion jobs fail terminally', () => {
    expect(r13MigrationSource).toContain('function public.fail_worker_job');
    expect(r13MigrationSource).toContain("if p_job_type = 'ingestion' then");
    expect(r13MigrationSource).toContain("set status = 'failed'");
    expect(r13MigrationSource).toContain(
      'perform public.enqueue_ready_processing_runs(p_source_id, p_cycle_date)',
    );
  });

  it('releases undigested processing claims when exhausted jobs are archived', () => {
    expect(r13MigrationSource).toContain('function public.archive_exhausted_worker_job');
    expect(r13MigrationSource).toContain("p_context ->> 'type' = 'processing'");
    expect(r13MigrationSource).toContain('from public.processed_digests');
    expect(r13MigrationSource).toContain('delete from public.flow_articles');
    expect(r13MigrationSource).toContain('where processing_run_id = failed_processing_run_id');
    expect(r13MigrationSource).toContain('and digest_id is null');
  });

  it('creates delivery attempts and ID-only queue messages when a digest is persisted', () => {
    expect(r14MigrationSource).toContain('function public.enqueue_digest_delivery_attempts');
    expect(r14MigrationSource).toContain('join public.flow_delivery_channels');
    expect(r14MigrationSource).toContain("and c.status = 'active'");
    expect(r14MigrationSource).toContain('on conflict (digest_id, channel_id) do nothing');
    expect(r14MigrationSource).toContain("perform pgmq.send(\n      'delivery-queue'");
    expect(r14MigrationSource).toContain("'type', 'delivery'");
    expect(r14MigrationSource).toContain("'attempt_id', attempt_rec.id");
    expect(r14MigrationSource).toContain(
      'perform public.enqueue_digest_delivery_attempts(existing_id)',
    );
  });

  it('records delivery retry backoff, permanent acknowledgement, and circuit state', () => {
    expect(r14MigrationSource).toContain('function public.claim_delivery_attempt');
    expect(r14MigrationSource).toContain("status in ('pending', 'failed')");
    expect(r14MigrationSource).toContain('next_attempt_at is null or next_attempt_at <= now()');
    expect(r14MigrationSource).toContain('function public.complete_delivery_worker_job');
    expect(r14MigrationSource).toContain('function public.acknowledge_delivery_worker_job');
    expect(r14MigrationSource).toContain('function public.requeue_delivery_worker_job');
    expect(r14MigrationSource).toContain("'attempt_id', p_attempt_id");
    expect(r14MigrationSource).toContain('function public.record_delivery_failure_worker_job');
    expect(r14MigrationSource).toContain('least(1800');
    expect(r14MigrationSource).toContain('coalesce(p_retry_after_seconds, 0)');
    expect(r14MigrationSource).toContain('pgmq.delete(p_queue_name, p_msg_id)');
    expect(r14MigrationSource).toContain('function public.claim_integration_circuit_probe');
    expect(r14MigrationSource).toContain("state = 'half_open'");
    expect(r14MigrationSource).toContain("state = 'open'");
  });

  it('schedules cleanup every 30 minutes to satisfy the purge lag SLA', () => {
    expect(schedulerMigrationSource).toContain("select cron.schedule(\n  'cleanup-job'");
    expect(schedulerMigrationSource).toContain("'*/30 * * * *'");
    expect(schedulerMigrationSource).toContain("url := 'http://kong:8000/functions/v1/cleanup'");
  });

  it('cleanup reclaims abandoned leases and applies distinct content and metadata lifecycles', () => {
    expect(r11gCleanupMigrationSource).toContain("where status = 'processing'");
    expect(r11gCleanupMigrationSource).toContain("started_at <= now() - interval '5 minutes'");
    expect(r11gCleanupMigrationSource).toContain("where status = 'sending'");
    expect(r11gCleanupMigrationSource).toContain("locked_at <= now() - interval '5 minutes'");
    expect(r11gCleanupMigrationSource).toContain(
      "delete from public.digest_delivery_attempts\n    where created_at <= now() - interval '7 days'",
    );
    expect(r11gCleanupMigrationSource).toContain(
      "delete from public.processed_digests\n    where created_at <= now() - interval '7 days'",
    );
    expect(r11gCleanupMigrationSource).toContain(
      "delete from public.ingested_articles\n    where created_at <= now() - interval '7 days'",
    );
    expect(r11gCleanupMigrationSource).toContain(
      "delete from public.source_fetch_runs\n    where created_at <= now() - interval '30 days'",
    );
    expect(r11gCleanupMigrationSource).toContain(
      "delete from public.processing_runs\n    where created_at <= now() - interval '30 days'",
    );
  });

  it('cleanup retains unresolved failures and preserves active circuit state', () => {
    expect(r11gCleanupMigrationSource).toContain(
      'delete from public.operational_events\n    where resolved_at is not null',
    );
    expect(r11gCleanupMigrationSource).not.toContain(
      "delete from public.operational_events\n    where first_seen_at <= now() - interval '7 days'",
    );
    expect(r11gCleanupMigrationSource).toContain(
      "delete from public.integration_circuits\n    where state = 'closed'",
    );
    expect(r11gCleanupMigrationSource).toContain("and updated_at <= now() - interval '30 days'");
  });

  it('keeps R-17 observability helper RPCs restricted to worker roles', () => {
    expect(allMigrationSources).toContain('function public.claim_operational_event_alert');
    expect(allMigrationSources).toContain('function public.get_ai_token_usage_since');
    expect(allMigrationSources).toContain('table if not exists public.ai_usage_events');
    expect(allMigrationSources).toContain('function public.record_ai_usage_event');
    expect(allMigrationSources).toContain('function public.fail_terminal_processing_worker_job');
    expect(allMigrationSources).toContain(
      'revoke execute on function public.claim_operational_event_alert(uuid, interval) from public',
    );
    expect(allMigrationSources).toContain(
      'grant execute on function public.claim_operational_event_alert(uuid, interval) to service_role, postgres',
    );
    expect(allMigrationSources).toContain(
      'revoke execute on function public.get_ai_token_usage_since(timestamp with time zone) from public',
    );
    expect(allMigrationSources).toContain(
      'grant execute on function public.get_ai_token_usage_since(timestamp with time zone) to service_role, postgres',
    );
    expect(allMigrationSources).toContain(
      'grant execute on function public.record_ai_usage_event(uuid, uuid, text, text, integer, text, text) to service_role, postgres',
    );
    expect(allMigrationSources).toContain(
      'grant execute on function public.fail_terminal_processing_worker_job(text, bigint, uuid, date, text) to service_role, postgres',
    );
  });

  it('dead-letter surfacing records sanitized operational events', () => {
    expect(workFunctionSource).toContain('p_context: sanitizeDlqContext(activeQueue, message)');
    expect(workFunctionSource).toContain('const sanitizeDlqContext =');
    expect(workFunctionSource).not.toMatch(/p_context:\s*message/);
    const archiveFunction = r13MigrationSource.slice(
      r13MigrationSource.indexOf('create or replace function public.archive_exhausted_worker_job'),
      r13MigrationSource.indexOf('create or replace function public.persist_processing_digest'),
    );
    expect(archiveFunction).toContain('function public.archive_exhausted_worker_job');
    expect(archiveFunction).toContain("event_id := public.log_operational_event(\n    'critical'");
    expect(archiveFunction).toContain("'dlq_exhaustion'");
    expect(archiveFunction).toContain('p_context');
    expect(archiveFunction).not.toContain('prompt_template');
  });

  it('does not introduce separate durable news-content storage or content-bearing queue payloads', () => {
    expect(allMigrationSources).not.toMatch(
      /create table public\.[a-z_]*(cache|cached|article_body|digest_body|news_content)[a-z_]*/i,
    );
    expect(allMigrationSources).not.toMatch(/create table public\.[a-z_]*payload[a-z_]*/i);

    const queueSendPayloads = [
      ...allMigrationSources.matchAll(
        /pgmq\.send\(\s*'[^']+',\s*jsonb_build_object\(([\s\S]*?)\)\s*\)/g,
      ),
    ].map((match) => match[1]);
    expect(queueSendPayloads.length).toBeGreaterThan(0);
    for (const payload of queueSendPayloads) {
      expect(payload).not.toMatch(
        /('content'|'article_body'|'body'|'digest_text'|'summary'|'prompt_template'|'config'|'credential'|'secret'|'token')/i,
      );
    }

    expect(workFunctionSource).not.toMatch(/localStorage|indexedDB|caches\.open|CacheStorage/);
  });
});
