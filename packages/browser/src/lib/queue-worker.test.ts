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

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcCall = { name: string; args?: Record<string, unknown> };

const makeClient = (
  responses: Record<string, RpcResult | ((args?: Record<string, unknown>) => RpcResult)>,
) => {
  const calls: RpcCall[] = [];
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
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
      complete_worker_job: { data: null, error: { message: 'Queue acknowledgement failed' } },
      fail_worker_job: { data: { updated_rows: 1 }, error: null },
    });
    const handler = createWorkHandler(() => fakeClient);

    const response = await handler(AUTH_REQ, {
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      status: 'failed',
      error: 'complete worker job failed: Queue acknowledgement failed',
    });
    expect(fakeClient.updates).toContainEqual({
      table: 'digest_delivery_attempts',
      patch: expect.objectContaining({ status: 'sending' }),
    });
    expect(fakeClient.calls.map((call) => call.name)).toContain('fail_worker_job');
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
});
