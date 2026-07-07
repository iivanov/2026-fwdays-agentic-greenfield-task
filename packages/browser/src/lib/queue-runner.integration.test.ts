import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { scheduleDailyHandler } from '../../../../supabase/functions/schedule-daily/index.ts';
import { workHandler } from '../../../../supabase/functions/work/index.ts';
import { cleanupHandler } from '../../../../supabase/functions/cleanup/index.ts';
import { LOCAL_SERVICE_KEY, LOCAL_SUPABASE_URL } from '../../../../tests/setup/supabase-local';

const LOCAL_SCHEDULER_SECRET = 'local-scheduler-secret';

describe('Scheduler and Queue Infrastructure Integration Tests', () => {
  let supabaseAdmin: ReturnType<typeof createClient>;
  let testUserId = '';

  beforeAll(async () => {
    supabaseAdmin = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Clean up queue-test users
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw new Error(
        `Failed to list Supabase auth users during integration setup: ${listError.message}`,
      );
    }
    if (list?.users) {
      for (const u of list.users) {
        if (u.email?.startsWith('queue-test-')) {
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(u.id);
          if (deleteError) {
            throw new Error(
              `Failed to delete stale queue-test user ${u.id}: ${deleteError.message}`,
            );
          }
        }
      }
    }

    // Create a fresh test user which auto provisions profile
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: `queue-test-${Date.now()}@example.com`,
      password: 'password123',
      email_confirm: true,
    });
    if (createError || !newUser?.user) {
      throw new Error(
        `Failed to create queue integration test user: ${createError?.message ?? 'no user returned'}`,
      );
    }
    testUserId = newUser.user.id;
  });

  it('should verify daily scheduling, queueing, worker drain, transient failure, DLQ, and cleanup', async () => {
    // Set dynamic service role db configuration setting for local net calls
    await supabaseAdmin.rpc('claim_job', { queue_name: 'ingestion-queue', lease_seconds: 1 }); // warm up pgmq
    await supabaseAdmin.rpc('set_app_setting', {
      key: 'app.settings.service_role_key',
      val: LOCAL_SERVICE_KEY,
    });
    await supabaseAdmin.rpc('set_app_setting', {
      key: 'app.settings.scheduler_secret',
      val: LOCAL_SCHEDULER_SECRET,
    });

    // Clean up queues and tables for test run
    const clearQueue = async (q: string) => {
      let messagesLeft = true;
      while (messagesLeft) {
        const { data } = await supabaseAdmin!.rpc('claim_job', { queue_name: q, lease_seconds: 1 });
        if (data && data.length > 0) {
          await supabaseAdmin!.rpc('delete_job', { queue_name: q, msg_id: data[0].msg_id });
        } else {
          messagesLeft = false;
        }
      }
    };
    await clearQueue('ingestion-queue');
    await clearQueue('processing-queue');
    await clearQueue('delivery-queue');

    await supabaseAdmin
      .from('processing_runs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin
      .from('source_fetch_runs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin
      .from('processing_flows')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin
      .from('global_sources')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    // 1. Seed a global source and a processing flow due for execution
    const { data: source } = await supabaseAdmin
      .from('global_sources')
      .insert({
        url: 'https://news.ycombinator.com/rss',
        type: 'rss',
      })
      .select('id')
      .single();

    expect(source).not.toBeNull();

    const { data: flow } = await supabaseAdmin
      .from('processing_flows')
      .insert({
        user_id: testUserId,
        name: 'Daily tech flow',
        frequency: 'daily',
        is_enabled: true,
        next_run_at: new Date(Date.now() - 10000).toISOString(),
      })
      .select('id')
      .single();

    expect(flow).not.toBeNull();

    // Trigger update as service_role (which bypasses handling trigger filter on next_run_at)
    await supabaseAdmin
      .from('processing_flows')
      .update({ next_run_at: new Date(Date.now() - 10000).toISOString() })
      .eq('id', flow!.id);

    // Associate source to flow
    await supabaseAdmin.from('flow_sources').insert({
      flow_id: flow!.id,
      source_id: source!.id,
    });

    // Test authorization failure (fail closed check)
    const unauthorizedReq = new Request('http://localhost/functions/v1/schedule-daily', {
      headers: { Authorization: '' },
    });
    const unauthorizedRes = await scheduleDailyHandler(unauthorizedReq, {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
    });
    expect(unauthorizedRes.status).toBe(401);

    // 2. Trigger daily scheduler edge function handler
    const schedReq = new Request('http://localhost/functions/v1/schedule-daily', {
      headers: { Authorization: `Bearer ${LOCAL_SCHEDULER_SECRET}` },
    });
    const schedRes = await scheduleDailyHandler(schedReq, {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
      SCHEDULER_SECRET: LOCAL_SCHEDULER_SECRET,
    });
    if (schedRes.status !== 200) {
      console.error('Schedule Daily Failed:', await schedRes.json());
    }
    expect(schedRes.status).toBe(200);

    const schedResult = await schedRes.json();
    expect(schedResult.data.flows_processed).toBe(1);
    expect(schedResult.data.jobs_enqueued).toBe(1);

    // Verify database run records were created in pending state
    const { data: fetchRuns } = await supabaseAdmin
      .from('source_fetch_runs')
      .select('*')
      .eq('source_id', source!.id);
    expect(fetchRuns?.length).toBe(1);
    expect(fetchRuns![0].status).toBe('pending');

    // 3. Trigger worker handler to consume the ingestion job
    const workReq = new Request('http://localhost/functions/v1/work', {
      headers: { Authorization: `Bearer ${LOCAL_SCHEDULER_SECRET}` },
    });
    const workRes = await workHandler(workReq, {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
      SCHEDULER_SECRET: LOCAL_SCHEDULER_SECRET,
    });
    expect(workRes.status).toBe(200);
    const workResult = await workRes.json();
    expect(workResult.status).toBe('completed');

    // Verify source fetch runs status transitions to completed
    const { data: fetchRunsPost } = await supabaseAdmin
      .from('source_fetch_runs')
      .select('*')
      .eq('source_id', source!.id);
    expect(fetchRunsPost![0].status).toBe('completed');

    const { data: processingJobs } = await supabaseAdmin.rpc('claim_job', {
      queue_name: 'processing-queue',
      lease_seconds: 1,
    });
    expect(processingJobs?.length).toBe(1);
    expect(processingJobs![0].message).toMatchObject({
      type: 'processing',
      flow_id: flow!.id,
      cycle_date: fetchRuns![0].cycle_date,
    });
    await supabaseAdmin.rpc('delete_job', {
      queue_name: 'processing-queue',
      msg_id: processingJobs![0].msg_id,
    });

    // 3b. Persisting a digest creates active-channel delivery attempts and
    // ID-only delivery queue messages.
    const { data: channel } = await supabaseAdmin
      .from('delivery_channels')
      .select('id')
      .eq('user_id', testUserId)
      .eq('type', 'in-app')
      .single();
    expect(channel).not.toBeNull();

    const digestCycleDate = '2031-02-03';
    const { data: processingRun } = await supabaseAdmin
      .from('processing_runs')
      .insert({ flow_id: flow!.id, cycle_date: digestCycleDate, status: 'processing' })
      .select('id')
      .single();
    expect(processingRun).not.toBeNull();

    const { data: digestArticle } = await supabaseAdmin
      .from('ingested_articles')
      .insert({
        source_id: source!.id,
        title: 'Delivery article',
        url: `https://example.com/article-${Date.now()}`,
        content: 'Article content for delivery integration.',
      })
      .select('id')
      .single();
    expect(digestArticle).not.toBeNull();

    await supabaseAdmin.from('flow_articles').insert({
      flow_id: flow!.id,
      article_id: digestArticle!.id,
      processing_run_id: processingRun!.id,
      status: 'claimed',
    });
    await supabaseAdmin.from('flow_delivery_channels').insert({
      flow_id: flow!.id,
      channel_id: channel!.id,
    });

    const digestId = crypto.randomUUID();
    const { data: persistedDigestId, error: persistError } = await supabaseAdmin.rpc(
      'persist_processing_digest',
      {
        p_digest_id: digestId,
        p_flow_id: flow!.id,
        p_processing_run_id: processingRun!.id,
        p_content: {
          title: 'Integration Digest',
          language: 'en',
          sections: [
            {
              heading: 'Delivery',
              items: [
                {
                  title: 'Attempt creation',
                  summary: 'Digest persistence creates delivery attempts.',
                  source_urls: ['https://example.com/article'],
                },
              ],
            },
          ],
        },
        p_token_usage: 42,
        p_provider_request_id: 'req-delivery-integration',
        p_model: 'gpt-5.4-mini',
      },
    );
    expect(persistError).toBeNull();
    expect(persistedDigestId).toBe(digestId);

    const { data: attempts } = await supabaseAdmin
      .from('digest_delivery_attempts')
      .select('id,digest_id,channel_id,status')
      .eq('digest_id', digestId);
    expect(attempts).toHaveLength(1);
    expect(attempts![0]).toMatchObject({
      digest_id: digestId,
      channel_id: channel!.id,
      status: 'pending',
    });

    const { data: deliveryJobs } = await supabaseAdmin.rpc('claim_job', {
      queue_name: 'delivery-queue',
      lease_seconds: 1,
    });
    expect(deliveryJobs?.length).toBe(1);
    expect(deliveryJobs![0].message).toEqual({
      type: 'delivery',
      attempt_id: attempts![0].id,
    });

    const circuitScopeKey = `integration-origin-${Date.now()}`;
    const { error: retryError } = await supabaseAdmin.rpc('record_delivery_failure_worker_job', {
      p_queue_name: 'delivery-queue',
      p_msg_id: deliveryJobs![0].msg_id,
      p_attempt_id: attempts![0].id,
      p_error_message: 'webhook_http_429',
      p_retryable: true,
      p_retry_after_seconds: 600,
      p_circuit_scope_type: 'webhook_origin',
      p_circuit_scope_key: circuitScopeKey,
    });
    expect(retryError).toBeNull();

    const { data: failedAttempt } = await supabaseAdmin
      .from('digest_delivery_attempts')
      .select('status,retry_count,next_attempt_at')
      .eq('id', attempts![0].id)
      .single();
    expect(failedAttempt!.status).toBe('failed');
    expect(failedAttempt!.retry_count).toBe(1);
    expect(new Date(failedAttempt!.next_attempt_at).getTime()).toBeGreaterThan(
      Date.now() + 500_000,
    );

    const { data: circuit } = await supabaseAdmin
      .from('integration_circuits')
      .select('scope_type,scope_key,consecutive_failure_count,state')
      .eq('scope_type', 'webhook_origin')
      .eq('scope_key', circuitScopeKey)
      .single();
    expect(circuit).toMatchObject({
      scope_type: 'webhook_origin',
      scope_key: circuitScopeKey,
      consecutive_failure_count: 1,
      state: 'closed',
    });
    await supabaseAdmin.rpc('delete_job', {
      queue_name: 'delivery-queue',
      msg_id: deliveryJobs![0].msg_id,
    });

    // 4. Test simulated transient failure
    // Enqueue job with simulate_failure: true
    await supabaseAdmin.rpc('claim_job', { queue_name: 'ingestion-queue', lease_seconds: 1 }); // ensure clean
    await supabaseAdmin.rpc('delete_job', {
      queue_name: 'ingestion-queue',
      msg_id: workResult.msg_id,
    });

    // Insert fake source run for next cycle date
    const nextDate = '2030-01-01';
    await supabaseAdmin.from('source_fetch_runs').insert({
      source_id: source!.id,
      cycle_date: nextDate,
      status: 'pending',
    });

    const { data: sendRes } = await supabaseAdmin.rpc('claim_job', {
      queue_name: 'ingestion-queue',
      lease_seconds: 1,
    });
    // Clear out
    if (sendRes && sendRes.length > 0) {
      await supabaseAdmin.rpc('delete_job', {
        queue_name: 'ingestion-queue',
        msg_id: sendRes[0].msg_id,
      });
    }

    // Direct insert to pgmq message using RPC helper
    await supabaseAdmin.rpc('send_to_queue', {
      queue_name: 'ingestion-queue',
      message: {
        type: 'ingestion',
        source_id: source!.id,
        cycle_date: nextDate,
        simulate_failure: true,
      },
    });

    // Call worker: should fail and throw
    const failRes = await workHandler(workReq, {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
      SCHEDULER_SECRET: LOCAL_SCHEDULER_SECRET,
    });
    expect(failRes.status).toBe(500);
    const failResult = await failRes.json();
    expect(failResult.status).toBe('failed');
    expect(failResult.error).toContain('Simulated worker execution failure');

    // Verify run record is set to failed
    const { data: fetchRunsFail } = await supabaseAdmin
      .from('source_fetch_runs')
      .select('*')
      .eq('source_id', source!.id)
      .eq('cycle_date', nextDate);
    expect(fetchRunsFail![0].status).toBe('failed');
    expect(fetchRunsFail![0].error_code).toContain('Simulated worker');

    // 5. Test DLQ boundary transition
    // Clear out queue
    await clearQueue('ingestion-queue');

    // Send a message directly and simulate read_ct > 5
    // To mock read_ct > 5 in claim_job, we can manually trigger the claim 6 times (which increments read_ct on each read)
    // Visibility lease = 1 second so we can read it in rapid succession!
    // Send a message directly using RPC helper
    await supabaseAdmin.rpc('send_to_queue', {
      queue_name: 'ingestion-queue',
      message: {
        type: 'ingestion',
        source_id: source!.id,
        cycle_date: nextDate,
      },
    });

    // Read message 5 times to bump retry count
    for (let i = 0; i < 5; i++) {
      const { data } = await supabaseAdmin.rpc('claim_job', {
        queue_name: 'ingestion-queue',
        lease_seconds: 1,
      });
      expect(data?.length).toBe(1);
      // Wait visibility timeout of 1 second
      await new Promise((r) => setTimeout(r, 1100));
    }

    // The 6th attempt: worker handles DLQ transition
    const dlqRes = await workHandler(workReq, {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
      SCHEDULER_SECRET: LOCAL_SCHEDULER_SECRET,
    });
    expect(dlqRes.status).toBe(200);
    const dlqResult = await dlqRes.json();
    expect(dlqResult.status).toBe('dlq_archived');

    // Verify operational events received the DLQ exhaustion log
    const { data: events } = await supabaseAdmin
      .from('operational_events')
      .select('*')
      .eq('category', 'dlq_exhaustion')
      .order('first_seen_at', { ascending: false });
    expect(events?.length).toBeGreaterThanOrEqual(1);

    // 6. Test cleanup visibility reset and prune older than 7 days
    const cleanupReq = new Request('http://localhost/functions/v1/cleanup', {
      headers: { Authorization: `Bearer ${LOCAL_SCHEDULER_SECRET}` },
    });
    const cleanupRes = await cleanupHandler(cleanupReq, {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
      SCHEDULER_SECRET: LOCAL_SCHEDULER_SECRET,
    });
    expect(cleanupRes.status).toBe(200);
    const cleanupResult = await cleanupRes.json();
    expect(cleanupResult.data).toHaveProperty('reclaimed_source_runs');
    expect(cleanupResult.data).toHaveProperty('reclaimed_delivery_runs');
    expect(cleanupResult.data).toHaveProperty('deleted_digests');
  }, 15000);
});
