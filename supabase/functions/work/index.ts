/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { withSupabase } from '@supabase/server';
import { createClient } from '@supabase/supabase-js';

// Types for claimed job message
interface JobMessage {
  msg_id: string | number;
  read_ct: number;
  enqueued_at: string;
  message: {
    type?: string;
    source_id?: string;
    flow_id?: string;
    attempt_id?: string;
    cycle_date?: string;
    simulate_failure?: boolean;
  };
}

export const workHandler = async (req: Request, envs: Record<string, string>) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceKey = envs.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Service key not configured' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isAuthorized = authHeader === `Bearer ${serviceKey}` || authHeader === serviceKey;
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(envs.SUPABASE_URL ?? '', serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const queues = ['delivery-queue', 'processing-queue', 'ingestion-queue'];
  let claimedJob: JobMessage | null = null;
  let activeQueue = '';

  // 1. Poll queues in priority order
  for (const q of queues) {
    const { data, error } = await supabaseAdmin.rpc('claim_job', {
      queue_name: q,
      lease_seconds: 300,
    });
    if (!error && data && data.length > 0) {
      claimedJob = data[0] as JobMessage;
      activeQueue = q;
      break;
    }
  }

  if (!claimedJob) {
    return new Response(JSON.stringify({ status: 'idle', message: 'No jobs in queue' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { msg_id, read_ct, message } = claimedJob;

  // 2. Dead-letter queue (DLQ) boundary
  if (read_ct > 5) {
    // Archive message
    await supabaseAdmin.rpc('archive_job', { queue_name: activeQueue, msg_id });

    // Log critical operational event
    await supabaseAdmin.rpc('log_operational_event', {
      p_severity: 'critical',
      p_category: 'dlq_exhaustion',
      p_deduplication_key: `msg_failed_dlq_${msg_id}`,
      p_context: { queue: activeQueue, message },
    });

    return new Response(
      JSON.stringify({ status: 'dlq_archived', msg_id, reason: 'Retry count exceeded 5' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // 3. Process the claimed job skeleton
  try {
    const isIngestion = activeQueue === 'ingestion-queue' || message.type === 'ingestion';
    const isProcessing = activeQueue === 'processing-queue' || message.type === 'processing';
    const isDelivery = activeQueue === 'delivery-queue' || message.type === 'delivery';

    const cycleDate = message.cycle_date || new Date().toISOString().split('T')[0];

    // Mark run as processing
    if (isIngestion && message.source_id) {
      await supabaseAdmin
        .from('source_fetch_runs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('source_id', message.source_id)
        .eq('cycle_date', cycleDate);
    } else if (isProcessing && message.flow_id) {
      await supabaseAdmin
        .from('processing_runs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('flow_id', message.flow_id)
        .eq('cycle_date', cycleDate);
    } else if (isDelivery && message.attempt_id) {
      await supabaseAdmin
        .from('digest_delivery_attempts')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', message.attempt_id);
    }

    // Check if we should simulate failure for testing retries and DLQ
    if (message.simulate_failure) {
      throw new Error('Simulated worker execution failure');
    }

    // Stub execution: Mark run as completed successfully
    if (isIngestion && message.source_id) {
      await supabaseAdmin
        .from('source_fetch_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('source_id', message.source_id)
        .eq('cycle_date', cycleDate);
    } else if (isProcessing && message.flow_id) {
      await supabaseAdmin
        .from('processing_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('flow_id', message.flow_id)
        .eq('cycle_date', cycleDate);
    } else if (isDelivery && message.attempt_id) {
      await supabaseAdmin
        .from('digest_delivery_attempts')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', message.attempt_id);
    }

    // Success: Delete message from queue
    await supabaseAdmin.rpc('delete_job', { queue_name: activeQueue, msg_id });

    return new Response(JSON.stringify({ status: 'completed', msg_id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown execution failure';

    // Mark run as failed
    const cycleDate = message.cycle_date || new Date().toISOString().split('T')[0];
    if (activeQueue === 'ingestion-queue' && message.source_id) {
      await supabaseAdmin
        .from('source_fetch_runs')
        .update({ status: 'failed', error_code: errMsg, completed_at: new Date().toISOString() })
        .eq('source_id', message.source_id)
        .eq('cycle_date', cycleDate);
    } else if (activeQueue === 'processing-queue' && message.flow_id) {
      await supabaseAdmin
        .from('processing_runs')
        .update({ status: 'failed', error_code: errMsg, completed_at: new Date().toISOString() })
        .eq('flow_id', message.flow_id)
        .eq('cycle_date', cycleDate);
    } else if (activeQueue === 'delivery-queue' && message.attempt_id) {
      await supabaseAdmin
        .from('digest_delivery_attempts')
        .update({ status: 'failed', error_code: errMsg, completed_at: new Date().toISOString() })
        .eq('id', message.attempt_id);
    }

    // Do NOT delete the message from pgmq so that pgmq retry visibility loop is triggered.
    // Return a 500 error indicating the processing cycle failed.
    return new Response(JSON.stringify({ status: 'failed', msg_id, error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export default {
  fetch: withSupabase({ auth: ['secret'] }, async (req) => {
    try {
      const envs = {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      };
      return await workHandler(req, envs);
    } catch (err: unknown) {
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Internal Server Error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }),
};
