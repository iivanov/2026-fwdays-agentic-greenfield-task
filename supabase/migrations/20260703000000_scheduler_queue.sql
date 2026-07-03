-- Migration: Enable pgmq and pg_cron and create background worker schedules and queue RPC helpers

-- 1. Enable extensions
create extension if not exists pgmq cascade;
create extension if not exists pg_cron cascade;

-- 2. Create the queues
select pgmq.create('ingestion-queue');
select pgmq.create('processing-queue');
select pgmq.create('delivery-queue');

-- 3. Register schedules in pg_cron using dynamic setting lookup for authorization headers
-- We target the internal api gateway (kong:8000) inside the docker container network.
select cron.schedule(
  'schedule-daily-job',
  '0 6 * * *',
  $$ select net.http_post(
       url := 'http://kong:8000/functions/v1/schedule-daily',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
       )
     ) $$
);

select cron.schedule(
  'worker-drain-job',
  '* * * * *',
  $$ select net.http_post(
       url := 'http://kong:8000/functions/v1/work',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
       )
     ) $$
);

select cron.schedule(
  'cleanup-job',
  '*/30 * * * *',
  $$ select net.http_post(
       url := 'http://kong:8000/functions/v1/cleanup',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
       )
     ) $$
);

-- 4. RPC Helper to log operational events securely with unresolved deduplication merging
create or replace function public.log_operational_event(
  p_severity text,
  p_category text,
  p_deduplication_key text,
  p_context jsonb
)
returns uuid as $$
declare
  existing_id uuid;
begin
  select id into existing_id
  from public.operational_events
  where deduplication_key = p_deduplication_key and resolved_at is null;

  if existing_id is not null then
    update public.operational_events
    set occurrence_count = occurrence_count + 1,
        last_seen_at = now(),
        context = context || p_context
    where id = existing_id;
    return existing_id;
  else
    insert into public.operational_events (severity, category, deduplication_key, context)
    values (p_severity, p_category, p_deduplication_key, p_context)
    returning id into existing_id;
    return existing_id;
  end if;
end;
$$ language plpgsql;

-- 5. RPC Helper to schedule daily flows atomically in database
create or replace function public.schedule_daily_flows()
returns jsonb as $$
declare
  flow_rec record;
  source_rec record;
  enqueued_count integer := 0;
  flows_processed integer := 0;
  cycle_dt date;
  new_run_id uuid;
begin
  for flow_rec in
    select id, next_run_at, user_id
    from public.processing_flows
    where is_enabled = true and next_run_at <= now()
    for update
  loop
    cycle_dt := flow_rec.next_run_at::date;
    
    begin
      insert into public.processing_runs (flow_id, cycle_date, status)
      values (flow_rec.id, cycle_dt, 'pending')
      returning id into new_run_id;
    exception when unique_violation then
      continue;
    end;

    flows_processed := flows_processed + 1;

    update public.processing_flows
    set last_run_at = flow_rec.next_run_at,
        next_run_at = flow_rec.next_run_at + interval '1 day',
        updated_at = now()
    where id = flow_rec.id;

    for source_rec in
      select source_id
      from public.flow_sources
      where flow_id = flow_rec.id
    loop
      begin
        insert into public.source_fetch_runs (source_id, cycle_date, status)
        values (source_rec.source_id, cycle_dt, 'pending');

        perform pgmq.send(
          'ingestion-queue',
          jsonb_build_object(
            'type', 'ingestion',
            'source_id', source_rec.source_id,
            'cycle_date', cycle_dt
          )
        );
        enqueued_count := enqueued_count + 1;
      exception when unique_violation then
        null;
      end;
    end loop;
  end loop;

  return jsonb_build_object(
    'flows_processed', flows_processed,
    'jobs_enqueued', enqueued_count
  );
end;
$$ language plpgsql;

-- 6. RPC Helpers for edge function queue claims and processing
create or replace function public.claim_job(queue_name text, lease_seconds integer)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamp with time zone,
  message jsonb
) as $$
begin
  return query execute format(
    'select msg_id, read_ct, enqueued_at, message from pgmq.read(%L, %s, 1)',
    queue_name,
    lease_seconds
  );
end;
$$ language plpgsql;

create or replace function public.delete_job(queue_name text, msg_id bigint)
returns boolean as $$
begin
  perform pgmq.delete(queue_name, msg_id);
  return true;
end;
$$ language plpgsql;

create or replace function public.archive_job(queue_name text, msg_id bigint)
returns boolean as $$
begin
  perform pgmq.archive(queue_name, msg_id);
  return true;
end;
$$ language plpgsql;

-- 7. RPC Helper for data pruning and visibility timeout resets
create or replace function public.cleanup_runs()
returns jsonb as $$
declare
  reclaimed_source_runs integer := 0;
  reclaimed_processing_runs integer := 0;
  reclaimed_delivery_runs integer := 0;
  deleted_digests integer := 0;
  deleted_articles integer := 0;
begin
  -- Reclaim abandoned source fetch runs (status = processing, older than 5 minutes)
  with u as (
    update public.source_fetch_runs
    set status = 'pending', started_at = null
    where status = 'processing' and started_at <= now() - interval '5 minutes'
    returning 1
  ) select count(*) into reclaimed_source_runs from u;

  -- Reclaim abandoned processing runs (status = processing, older than 5 minutes)
  with u as (
    update public.processing_runs
    set status = 'pending', started_at = null
    where status = 'processing' and started_at <= now() - interval '5 minutes'
    returning 1
  ) select count(*) into reclaimed_processing_runs from u;

  -- Reclaim abandoned digest delivery attempts (status = sending, locked_at older than 5 minutes)
  with u as (
    update public.digest_delivery_attempts
    set status = 'pending', locked_at = null
    where status = 'sending' and locked_at <= now() - interval '5 minutes'
    returning 1
  ) select count(*) into reclaimed_delivery_runs from u;

  -- Delete old digests (created more than 7 days ago)
  with d as (
    delete from public.processed_digests
    where created_at <= now() - interval '7 days'
    returning 1
  ) select count(*) into deleted_digests from d;

  -- Delete old ingested articles (created more than 7 days ago)
  with d as (
    delete from public.ingested_articles
    where created_at <= now() - interval '7 days'
    returning 1
  ) select count(*) into deleted_articles from d;

  -- Delete old fetch runs
  delete from public.source_fetch_runs
  where created_at <= now() - interval '7 days';

  -- Delete old processing runs
  delete from public.processing_runs
  where created_at <= now() - interval '7 days';

  -- Delete old operational events
  delete from public.operational_events
  where first_seen_at <= now() - interval '7 days';

  return jsonb_build_object(
    'reclaimed_source_runs', reclaimed_source_runs,
    'reclaimed_processing_runs', reclaimed_processing_runs,
    'reclaimed_delivery_runs', reclaimed_delivery_runs,
    'deleted_digests', deleted_digests,
    'deleted_articles', deleted_articles
  );
end;
$$ language plpgsql;

-- 8. RPC Helper to set database custom configuration values dynamically (e.g. for testing)
create or replace function public.set_app_setting(key text, val text)
returns boolean as $$
begin
  execute format('alter database postgres set %I = %L', key, val);
  return true;
end;
$$ language plpgsql;

-- 9. RPC Helper to send message to pgmq queues from client client calls
create or replace function public.send_to_queue(queue_name text, message jsonb)
returns bigint as $$
begin
  return pgmq.send(queue_name, message);
end;
$$ language plpgsql;

-- 10. Grant access to pgmq schema resources to service_role and postgres roles
grant usage on schema pgmq to service_role, postgres;
grant all privileges on all tables in schema pgmq to service_role, postgres;
grant all privileges on all sequences in schema pgmq to service_role, postgres;
grant all privileges on all functions in schema pgmq to service_role, postgres;

-- 11. Security defaults: Revoke execution rights from public role, limit to postgres & service_role
revoke execute on function public.schedule_daily_flows() from public;
revoke execute on function public.claim_job(text, integer) from public;
revoke execute on function public.delete_job(text, bigint) from public;
revoke execute on function public.archive_job(text, bigint) from public;
revoke execute on function public.cleanup_runs() from public;
revoke execute on function public.set_app_setting(text, text) from public;
revoke execute on function public.send_to_queue(text, jsonb) from public;
revoke execute on function public.log_operational_event(text, text, text, jsonb) from public;

grant execute on function public.schedule_daily_flows() to service_role, postgres;
grant execute on function public.claim_job(text, integer) to service_role, postgres;
grant execute on function public.delete_job(text, bigint) to service_role, postgres;
grant execute on function public.archive_job(text, bigint) to service_role, postgres;
grant execute on function public.cleanup_runs() to service_role, postgres;
grant execute on function public.set_app_setting(text, text) to service_role, postgres;
grant execute on function public.send_to_queue(text, jsonb) to service_role, postgres;
grant execute on function public.log_operational_event(text, text, text, jsonb) to service_role, postgres;
