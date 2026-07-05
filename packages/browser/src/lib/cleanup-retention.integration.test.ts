import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { cleanupHandler } from '../../../../supabase/functions/cleanup/index.ts';
import { LOCAL_SERVICE_KEY, LOCAL_SUPABASE_URL } from '../../../../tests/setup/supabase-local';

describe('R-11G cleanup retention lifecycle integration', () => {
  let supabaseAdmin: ReturnType<typeof createClient>;
  let testUserId = '';

  beforeAll(async () => {
    supabaseAdmin = createClient(LOCAL_SUPABASE_URL, LOCAL_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list Supabase auth users: ${listError.message}`);
    }
    for (const user of list?.users ?? []) {
      if (user.email?.startsWith('retention-test-')) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          throw new Error(`Failed to delete stale retention test user: ${deleteError.message}`);
        }
      }
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: `retention-test-${Date.now()}@example.com`,
      password: 'password123',
      email_confirm: true,
    });
    if (createError || !newUser?.user) {
      throw new Error(
        `Failed to create retention integration test user: ${createError?.message ?? 'no user returned'}`,
      );
    }
    testUserId = newUser.user.id;
  });

  it('purges seven-day content while retaining unresolved failures and active metadata', async () => {
    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { data: source, error: sourceError } = await supabaseAdmin
      .from('global_sources')
      .insert({
        url: `https://example.com/retention-${unique}.xml`,
        type: 'rss',
      })
      .select('id')
      .single();
    expect(sourceError).toBeNull();

    const { data: flow, error: flowError } = await supabaseAdmin
      .from('processing_flows')
      .insert({
        user_id: testUserId,
        name: `Retention ${unique}`,
        frequency: 'daily',
        is_enabled: true,
        next_run_at: daysAgo(1),
      })
      .select('id')
      .single();
    expect(flowError).toBeNull();

    const { data: sourceRun, error: sourceRunError } = await supabaseAdmin
      .from('source_fetch_runs')
      .insert({
        source_id: source!.id,
        cycle_date: '2029-01-01',
        status: 'completed',
        created_at: daysAgo(20),
      })
      .select('id')
      .single();
    expect(sourceRunError).toBeNull();

    const { data: processingRun, error: processingRunError } = await supabaseAdmin
      .from('processing_runs')
      .insert({
        flow_id: flow!.id,
        cycle_date: '2029-01-01',
        status: 'completed',
        created_at: daysAgo(20),
      })
      .select('id')
      .single();
    expect(processingRunError).toBeNull();

    const { data: article, error: articleError } = await supabaseAdmin
      .from('ingested_articles')
      .insert({
        source_id: source!.id,
        external_guid: `retention-${unique}`,
        title: 'Expired article',
        url: `https://example.com/articles/${unique}`,
        content: 'expired content',
        published_at: daysAgo(10),
        created_at: daysAgo(8),
      })
      .select('id')
      .single();
    expect(articleError).toBeNull();

    const { data: digest, error: digestError } = await supabaseAdmin
      .from('processed_digests')
      .insert({
        flow_id: flow!.id,
        processing_run_id: processingRun!.id,
        content: { title: 'Expired digest', sections: [] },
        token_usage: 10,
        model: 'gpt-5.4-mini',
        created_at: daysAgo(8),
      })
      .select('id')
      .single();
    expect(digestError).toBeNull();

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('digest_delivery_attempts')
      .insert({
        digest_id: digest!.id,
        status: 'delivered',
        created_at: daysAgo(8),
      })
      .select('id')
      .single();
    expect(attemptError).toBeNull();

    const unresolvedKey = `retention-unresolved-${unique}`;
    const resolvedKey = `retention-resolved-${unique}`;
    const { data: unresolvedEvent, error: unresolvedError } = await supabaseAdmin
      .from('operational_events')
      .insert({
        severity: 'critical',
        category: 'dead_letter',
        deduplication_key: unresolvedKey,
        context: { job: 'retention-test' },
        first_seen_at: daysAgo(40),
        last_seen_at: daysAgo(40),
      })
      .select('id')
      .single();
    expect(unresolvedError).toBeNull();
    const { data: resolvedEvent, error: resolvedError } = await supabaseAdmin
      .from('operational_events')
      .insert({
        severity: 'warning',
        category: 'cleanup_recovered',
        deduplication_key: resolvedKey,
        context: { job: 'retention-test' },
        first_seen_at: daysAgo(40),
        last_seen_at: daysAgo(40),
        resolved_at: daysAgo(31),
      })
      .select('id')
      .single();
    expect(resolvedError).toBeNull();

    const openCircuitKey = `retention-open-${unique}`;
    const closedCircuitKey = `retention-closed-${unique}`;
    const { data: openCircuit, error: openCircuitError } = await supabaseAdmin
      .from('integration_circuits')
      .insert({
        scope_type: 'webhook_origin',
        scope_key: openCircuitKey,
        state: 'open',
        consecutive_failure_count: 5,
        opened_at: daysAgo(40),
        updated_at: daysAgo(40),
      })
      .select('id')
      .single();
    expect(openCircuitError).toBeNull();
    const { data: closedCircuit, error: closedCircuitError } = await supabaseAdmin
      .from('integration_circuits')
      .insert({
        scope_type: 'webhook_origin',
        scope_key: closedCircuitKey,
        state: 'closed',
        updated_at: daysAgo(31),
      })
      .select('id')
      .single();
    expect(closedCircuitError).toBeNull();

    const cleanupReq = new Request('http://localhost/functions/v1/cleanup', {
      headers: { Authorization: `Bearer ${LOCAL_SERVICE_KEY}` },
    });
    const cleanupRes = await cleanupHandler(cleanupReq, {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
    });
    expect(cleanupRes.status).toBe(200);
    const cleanupResult = await cleanupRes.json();
    expect(cleanupResult.data).toHaveProperty('deleted_articles');
    expect(cleanupResult.data).toHaveProperty('deleted_digests');
    expect(cleanupResult.data).toHaveProperty('deleted_operational_events');
    expect(cleanupResult.data).toHaveProperty('deleted_integration_circuits');

    const byId = async (table: string, id: string) =>
      supabaseAdmin.from(table).select('id').eq('id', id).maybeSingle();

    expect((await byId('ingested_articles', article!.id)).data).toBeNull();
    expect((await byId('processed_digests', digest!.id)).data).toBeNull();
    expect((await byId('digest_delivery_attempts', attempt!.id)).data).toBeNull();
    expect((await byId('source_fetch_runs', sourceRun!.id)).data?.id).toBe(sourceRun!.id);
    expect((await byId('processing_runs', processingRun!.id)).data?.id).toBe(processingRun!.id);
    expect((await byId('operational_events', unresolvedEvent!.id)).data?.id).toBe(
      unresolvedEvent!.id,
    );
    expect((await byId('operational_events', resolvedEvent!.id)).data).toBeNull();
    expect((await byId('integration_circuits', openCircuit!.id)).data?.id).toBe(openCircuit!.id);
    expect((await byId('integration_circuits', closedCircuit!.id)).data).toBeNull();
  });

  it('recovers stale source, processing, and delivery leases', async () => {
    const now = Date.now();
    const minutesAgo = (minutes: number) => new Date(now - minutes * 60 * 1000).toISOString();
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { data: source, error: sourceError } = await supabaseAdmin
      .from('global_sources')
      .insert({
        url: `https://example.com/stale-lease-${unique}.xml`,
        type: 'rss',
      })
      .select('id')
      .single();
    expect(sourceError).toBeNull();

    const { data: flow, error: flowError } = await supabaseAdmin
      .from('processing_flows')
      .insert({
        user_id: testUserId,
        name: `Stale lease ${unique}`,
        frequency: 'daily',
        is_enabled: true,
        next_run_at: minutesAgo(60),
      })
      .select('id')
      .single();
    expect(flowError).toBeNull();

    const { data: sourceRun, error: sourceRunError } = await supabaseAdmin
      .from('source_fetch_runs')
      .insert({
        source_id: source!.id,
        cycle_date: '2032-01-01',
        status: 'processing',
        started_at: minutesAgo(10),
      })
      .select('id')
      .single();
    expect(sourceRunError).toBeNull();

    const { data: processingRun, error: processingRunError } = await supabaseAdmin
      .from('processing_runs')
      .insert({
        flow_id: flow!.id,
        cycle_date: '2032-01-01',
        status: 'processing',
        started_at: minutesAgo(10),
      })
      .select('id')
      .single();
    expect(processingRunError).toBeNull();

    const { data: digest, error: digestError } = await supabaseAdmin
      .from('processed_digests')
      .insert({
        flow_id: flow!.id,
        processing_run_id: processingRun!.id,
        content: { title: 'Active digest', sections: [] },
        token_usage: 1,
        model: 'gpt-5.4-mini',
      })
      .select('id')
      .single();
    expect(digestError).toBeNull();

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('digest_delivery_attempts')
      .insert({
        digest_id: digest!.id,
        status: 'sending',
        locked_at: minutesAgo(10),
      })
      .select('id')
      .single();
    expect(attemptError).toBeNull();

    const cleanupReq = new Request('http://localhost/functions/v1/cleanup', {
      headers: { Authorization: `Bearer ${LOCAL_SERVICE_KEY}` },
    });
    const cleanupRes = await cleanupHandler(cleanupReq, {
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SERVICE_KEY,
    });
    expect(cleanupRes.status).toBe(200);
    const cleanupResult = await cleanupRes.json();
    expect(cleanupResult.data).toMatchObject({
      reclaimed_source_runs: expect.any(Number),
      reclaimed_processing_runs: expect.any(Number),
      reclaimed_delivery_runs: expect.any(Number),
    });

    const { data: recoveredSourceRun } = await supabaseAdmin
      .from('source_fetch_runs')
      .select('status,started_at')
      .eq('id', sourceRun!.id)
      .single();
    expect(recoveredSourceRun).toEqual({ status: 'pending', started_at: null });

    const { data: recoveredProcessingRun } = await supabaseAdmin
      .from('processing_runs')
      .select('status,started_at')
      .eq('id', processingRun!.id)
      .single();
    expect(recoveredProcessingRun).toEqual({ status: 'pending', started_at: null });

    const { data: recoveredAttempt } = await supabaseAdmin
      .from('digest_delivery_attempts')
      .select('status,locked_at')
      .eq('id', attempt!.id)
      .single();
    expect(recoveredAttempt).toEqual({ status: 'pending', locked_at: null });
  });
});
