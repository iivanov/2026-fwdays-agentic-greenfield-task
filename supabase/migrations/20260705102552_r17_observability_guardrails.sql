-- R-17: database-backed operational alert deduplication.

create or replace function public.claim_operational_event_alert(
  p_event_id uuid,
  p_cooldown interval default interval '1 hour'
)
returns jsonb as $$
declare
  claimed_event record;
begin
  update public.operational_events
  set alerted_at = now()
  where id = p_event_id
    and severity = 'critical'
    and resolved_at is null
    and (alerted_at is null or alerted_at <= now() - p_cooldown)
  returning id,
            severity,
            category,
            deduplication_key,
            context,
            occurrence_count,
            first_seen_at,
            last_seen_at,
            alerted_at
  into claimed_event;

  if claimed_event.id is null then
    return jsonb_build_object('claimed', false);
  end if;

  return jsonb_build_object(
    'claimed', true,
    'event_id', claimed_event.id,
    'severity', claimed_event.severity,
    'category', claimed_event.category,
    'deduplication_key', claimed_event.deduplication_key,
    'context', claimed_event.context,
    'occurrence_count', claimed_event.occurrence_count,
    'first_seen_at', claimed_event.first_seen_at,
    'last_seen_at', claimed_event.last_seen_at,
    'alerted_at', claimed_event.alerted_at
  );
end;
$$ language plpgsql;

revoke execute on function public.claim_operational_event_alert(uuid, interval) from public;
grant execute on function public.claim_operational_event_alert(uuid, interval) to service_role, postgres;

create index if not exists operational_events_critical_alert_idx
  on public.operational_events (severity, resolved_at, alerted_at)
  where severity = 'critical' and resolved_at is null;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid references public.processing_flows(id) on delete cascade,
  processing_run_id uuid references public.processing_runs(id) on delete cascade,
  provider text default 'openai' not null,
  provider_request_id text,
  model text,
  token_usage integer not null check (token_usage >= 0),
  outcome text not null check (outcome in ('failed_budget', 'failed_provider')),
  reason text not null,
  occurred_at timestamp with time zone default now() not null
);

alter table public.ai_usage_events enable row level security;

create index if not exists ai_usage_events_occurred_at_idx
  on public.ai_usage_events (occurred_at);

create index if not exists ai_usage_events_processing_run_idx
  on public.ai_usage_events (processing_run_id);

revoke all on table public.ai_usage_events from anon, authenticated;
grant all on table public.ai_usage_events to service_role;

create or replace function public.record_ai_usage_event(
  p_flow_id uuid,
  p_processing_run_id uuid,
  p_provider_request_id text,
  p_model text,
  p_token_usage integer,
  p_outcome text,
  p_reason text
)
returns uuid as $$
declare
  event_id uuid;
begin
  insert into public.ai_usage_events (
    flow_id,
    processing_run_id,
    provider_request_id,
    model,
    token_usage,
    outcome,
    reason
  )
  values (
    p_flow_id,
    p_processing_run_id,
    p_provider_request_id,
    p_model,
    greatest(coalesce(p_token_usage, 0), 0),
    p_outcome,
    p_reason
  )
  returning id into event_id;

  return event_id;
end;
$$ language plpgsql;

revoke execute on function public.record_ai_usage_event(uuid, uuid, text, text, integer, text, text) from public;
grant execute on function public.record_ai_usage_event(uuid, uuid, text, text, integer, text, text) to service_role, postgres;

create or replace function public.get_ai_token_usage_since(p_since timestamp with time zone)
returns bigint as $$
  select (
    coalesce((
      select sum(token_usage)
      from public.processed_digests
      where created_at >= p_since
    ), 0) +
    coalesce((
      select sum(token_usage)
      from public.ai_usage_events
      where occurred_at >= p_since
    ), 0)
  )::bigint;
$$ language sql stable;

revoke execute on function public.get_ai_token_usage_since(timestamp with time zone) from public;
grant execute on function public.get_ai_token_usage_since(timestamp with time zone) to service_role, postgres;

create or replace function public.fail_terminal_processing_worker_job(
  p_queue_name text,
  p_msg_id bigint,
  p_flow_id uuid,
  p_cycle_date date,
  p_error_message text
)
returns jsonb as $$
declare
  affected_rows integer := 0;
  deleted boolean := false;
begin
  perform public.validate_worker_queue_name(p_queue_name);

  update public.processing_runs
  set status = 'failed',
      error_code = left(p_error_message, 100),
      completed_at = now()
  where flow_id = p_flow_id and cycle_date = p_cycle_date;
  get diagnostics affected_rows = row_count;

  deleted := pgmq.delete(p_queue_name, p_msg_id);
  if deleted is not true then
    raise exception 'Queue acknowledgement failed for % message %', p_queue_name, p_msg_id using errcode = 'object_not_in_prerequisite_state';
  end if;

  return jsonb_build_object('updated_rows', affected_rows, 'acknowledged', true);
end;
$$ language plpgsql;

revoke execute on function public.fail_terminal_processing_worker_job(text, bigint, uuid, date, text) from public;
grant execute on function public.fail_terminal_processing_worker_job(text, bigint, uuid, date, text) to service_role, postgres;
