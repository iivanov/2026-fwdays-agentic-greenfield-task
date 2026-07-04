/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { withSupabase } from '@supabase/server';
import { createClient } from '@supabase/supabase-js';

interface JobPayload {
  type?: string;
  source_id?: string;
  flow_id?: string;
  attempt_id?: string;
  cycle_date?: string;
  simulate_failure?: boolean;
}

interface JobMessage {
  msg_id: string | number;
  read_ct: number;
  enqueued_at: string;
  message: JobPayload;
}

type RpcResult<T = unknown> = { data: T; error: { message: string } | null };

type QueryBuilder = {
  eq: (column: string, value: string) => QueryBuilder;
  then: <TResult1 = { error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => PromiseLike<TResult1 | TResult2>;
};

type SupabaseAdmin = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => QueryBuilder;
  };
};

type WorkerKind = 'ingestion' | 'processing' | 'delivery';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const getWorkerKind = (queueName: string, message: JobPayload): WorkerKind | null => {
  if (queueName === 'ingestion-queue' || message.type === 'ingestion') return 'ingestion';
  if (queueName === 'processing-queue' || message.type === 'processing') return 'processing';
  if (queueName === 'delivery-queue' || message.type === 'delivery') return 'delivery';
  return null;
};

const sanitizeDlqContext = (queue: string, message: JobPayload) => ({
  queue,
  type: message.type ?? null,
  source_id: message.source_id ?? null,
  flow_id: message.flow_id ?? null,
  attempt_id: message.attempt_id ?? null,
  cycle_date: message.cycle_date ?? null,
});

const assertRpcOk = <T>(result: { data: T; error: { message: string } | null }, label: string) => {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
};

const markProcessing = async (
  supabaseAdmin: SupabaseAdmin,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
) => {
  if (kind === 'ingestion' && message.source_id) {
    const { error } = await supabaseAdmin
      .from('source_fetch_runs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('source_id', message.source_id)
      .eq('cycle_date', cycleDate);
    if (error) throw new Error(`mark ingestion processing failed: ${error.message}`);
  } else if (kind === 'processing' && message.flow_id) {
    const { error } = await supabaseAdmin
      .from('processing_runs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('flow_id', message.flow_id)
      .eq('cycle_date', cycleDate);
    if (error) throw new Error(`mark processing run failed: ${error.message}`);
  } else if (kind === 'delivery' && message.attempt_id) {
    const { error } = await supabaseAdmin
      .from('digest_delivery_attempts')
      .update({
        status: 'sending',
        locked_at: new Date().toISOString(),
        attempted_at: new Date().toISOString(),
      })
      .eq('id', message.attempt_id);
    if (error) throw new Error(`mark delivery sending failed: ${error.message}`);
  }
};

const completeJob = async (
  supabaseAdmin: SupabaseAdmin,
  activeQueue: string,
  msgId: string | number,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('complete_worker_job', {
      p_queue_name: activeQueue,
      p_msg_id: msgId,
      p_job_type: kind,
      p_source_id: message.source_id ?? null,
      p_flow_id: message.flow_id ?? null,
      p_attempt_id: message.attempt_id ?? null,
      p_cycle_date: cycleDate,
    }),
    'complete worker job failed',
  );
};

const failJob = async (
  supabaseAdmin: SupabaseAdmin,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
  errorMessage: string,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('fail_worker_job', {
      p_job_type: kind,
      p_error_message: errorMessage,
      p_source_id: message.source_id ?? null,
      p_flow_id: message.flow_id ?? null,
      p_attempt_id: message.attempt_id ?? null,
      p_cycle_date: cycleDate,
    }),
    'record worker failure failed',
  );
};

type CreateAdminClient = (url: string, serviceKey: string) => SupabaseAdmin;

export const createWorkHandler =
  (createAdminClient: CreateAdminClient) => async (req: Request, envs: Record<string, string>) => {
    const authHeader = req.headers.get('Authorization') ?? '';
    const serviceKey = envs.SUPABASE_SERVICE_ROLE_KEY ?? '';

    if (!serviceKey) return json({ error: 'Unauthorized: Service key not configured' }, 401);
    if (authHeader !== `Bearer ${serviceKey}` && authHeader !== serviceKey) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseAdmin = createAdminClient(envs.SUPABASE_URL ?? '', serviceKey);

    const queues = ['delivery-queue', 'processing-queue', 'ingestion-queue'];
    let claimedJob: JobMessage | null = null;
    let activeQueue = '';

    for (const queueName of queues) {
      const { data, error } = await supabaseAdmin.rpc('claim_job', {
        queue_name: queueName,
        lease_seconds: 300,
      });
      if (error) {
        return json({ status: 'claim_failed', queue: queueName, error: error.message }, 500);
      }
      const jobs = data as JobMessage[] | null;
      if (jobs && jobs.length > 0) {
        claimedJob = jobs[0];
        activeQueue = queueName;
        break;
      }
    }

    if (!claimedJob) return json({ status: 'idle', message: 'No jobs in queue' });

    const { msg_id: msgId, read_ct: readCount, message } = claimedJob;
    const kind = getWorkerKind(activeQueue, message);
    const cycleDate = message.cycle_date || new Date().toISOString().split('T')[0];

    if (!kind) return json({ status: 'failed', msg_id: msgId, error: 'Unsupported job type' }, 500);

    if (readCount > 5) {
      const { error } = await supabaseAdmin.rpc('archive_exhausted_worker_job', {
        p_queue_name: activeQueue,
        p_msg_id: msgId,
        p_event_key: `msg_failed_dlq_${activeQueue}_${msgId}`,
        p_context: sanitizeDlqContext(activeQueue, message),
      });
      if (error) {
        return json({ status: 'dlq_archive_failed', msg_id: msgId, error: error.message }, 500);
      }
      return json({ status: 'dlq_archived', msg_id: msgId, reason: 'Retry count exceeded 5' });
    }

    try {
      await markProcessing(supabaseAdmin, kind, message, cycleDate);

      if (message.simulate_failure) throw new Error('Simulated worker execution failure');

      await completeJob(supabaseAdmin, activeQueue, msgId, kind, message, cycleDate);

      return json({ status: 'completed', msg_id: msgId });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown execution failure';

      try {
        await failJob(supabaseAdmin, kind, message, cycleDate, errMsg);
      } catch (failureRecordErr: unknown) {
        const recordError = failureRecordErr instanceof Error
          ? failureRecordErr.message
          : 'Unknown failure recording error';
        return json({
          status: 'failed',
          msg_id: msgId,
          error: errMsg,
          failure_record_error: recordError,
        }, 500);
      }

      return json({ status: 'failed', msg_id: msgId, error: errMsg }, 500);
    }
  };

export const workHandler = createWorkHandler((url, serviceKey) =>
  createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseAdmin
);

export default {
  fetch: withSupabase({ auth: ['secret'] }, async (req) => {
    try {
      const envs = {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      };
      return await workHandler(req, envs);
    } catch (err: unknown) {
      return json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
    }
  }),
};
