import { readFileSync } from 'node:fs';
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
    const fakeClient = makeClient({
      claim_job: {
        data: [
          {
            msg_id: 99,
            read_ct: 6,
            enqueued_at: new Date().toISOString(),
            message: { type: 'ingestion', source_id: '22222222-2222-2222-2222-222222222222' },
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
    expect(fakeClient.updates).toEqual([]);
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
});
