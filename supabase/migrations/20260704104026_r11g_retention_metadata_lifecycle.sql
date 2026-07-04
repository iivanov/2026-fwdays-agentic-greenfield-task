-- R-11G: correct content and operational metadata lifecycle cleanup.

create or replace function public.cleanup_runs()
returns jsonb as $$
declare
  reclaimed_source_runs integer := 0;
  reclaimed_processing_runs integer := 0;
  reclaimed_delivery_runs integer := 0;
  deleted_delivery_attempts integer := 0;
  deleted_digests integer := 0;
  deleted_articles integer := 0;
  deleted_source_fetch_runs integer := 0;
  deleted_processing_runs integer := 0;
  deleted_operational_events integer := 0;
  deleted_integration_circuits integer := 0;
begin
  -- Reclaim abandoned source fetch runs (status = processing, older than 5 minutes).
  with u as (
    update public.source_fetch_runs
    set status = 'pending', started_at = null
    where status = 'processing' and started_at <= now() - interval '5 minutes'
    returning 1
  ) select count(*) into reclaimed_source_runs from u;

  -- Reclaim abandoned processing runs (status = processing, older than 5 minutes).
  with u as (
    update public.processing_runs
    set status = 'pending', started_at = null
    where status = 'processing' and started_at <= now() - interval '5 minutes'
    returning 1
  ) select count(*) into reclaimed_processing_runs from u;

  -- Reclaim abandoned digest delivery attempts (status = sending, older than 5 minutes).
  with u as (
    update public.digest_delivery_attempts
    set status = 'pending', locked_at = null
    where status = 'sending' and locked_at <= now() - interval '5 minutes'
    returning 1
  ) select count(*) into reclaimed_delivery_runs from u;

  -- Content-bearing delivery attempt rows are seven-day data.
  with d as (
    delete from public.digest_delivery_attempts
    where created_at <= now() - interval '7 days'
    returning 1
  ) select count(*) into deleted_delivery_attempts from d;

  -- Generated digest content is seven-day data. Remaining attempts for deleted
  -- digests are removed by ON DELETE CASCADE.
  with d as (
    delete from public.processed_digests
    where created_at <= now() - interval '7 days'
    returning 1
  ) select count(*) into deleted_digests from d;

  -- Ingested article content is seven-day data.
  with d as (
    delete from public.ingested_articles
    where created_at <= now() - interval '7 days'
    returning 1
  ) select count(*) into deleted_articles from d;

  -- Run metadata is sanitized operational metadata and may outlive content for
  -- 30 days.
  with d as (
    delete from public.source_fetch_runs
    where created_at <= now() - interval '30 days'
    returning 1
  ) select count(*) into deleted_source_fetch_runs from d;

  with d as (
    delete from public.processing_runs
    where created_at <= now() - interval '30 days'
    returning 1
  ) select count(*) into deleted_processing_runs from d;

  -- Unresolved failures remain operator-visible. Only resolved metadata ages out.
  with d as (
    delete from public.operational_events
    where resolved_at is not null
      and resolved_at <= now() - interval '30 days'
    returning 1
  ) select count(*) into deleted_operational_events from d;

  -- Active circuit state remains live. Closed stale circuits are metadata.
  with d as (
    delete from public.integration_circuits
    where state = 'closed'
      and updated_at <= now() - interval '30 days'
    returning 1
  ) select count(*) into deleted_integration_circuits from d;

  return jsonb_build_object(
    'reclaimed_source_runs', reclaimed_source_runs,
    'reclaimed_processing_runs', reclaimed_processing_runs,
    'reclaimed_delivery_runs', reclaimed_delivery_runs,
    'deleted_delivery_attempts', deleted_delivery_attempts,
    'deleted_digests', deleted_digests,
    'deleted_articles', deleted_articles,
    'deleted_source_fetch_runs', deleted_source_fetch_runs,
    'deleted_processing_runs', deleted_processing_runs,
    'deleted_operational_events', deleted_operational_events,
    'deleted_integration_circuits', deleted_integration_circuits
  );
end;
$$ language plpgsql;

revoke execute on function public.cleanup_runs() from public;
grant execute on function public.cleanup_runs() to service_role, postgres;
