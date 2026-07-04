-- R-13: preserve explicit no_content processing outcomes, enqueue AI
-- processing after ingestion reaches a terminal source-cycle state, and keep
-- digest persistence/article inclusion transactional.

alter table public.processing_runs
  add column if not exists processing_enqueued_at timestamp with time zone;

create or replace function public.enqueue_ready_processing_runs(
  p_source_id uuid,
  p_cycle_date date
)
returns integer as $$
declare
  processing_rec record;
  enqueued_count integer := 0;
begin
  for processing_rec in
    select pr.id, pr.flow_id, pr.cycle_date
    from public.processing_runs pr
    join public.flow_sources trigger_source
      on trigger_source.flow_id = pr.flow_id
     and trigger_source.source_id = p_source_id
    where pr.cycle_date = p_cycle_date
      and pr.status = 'pending'
      and pr.processing_enqueued_at is null
      and not exists (
        select 1
        from public.flow_sources fs
        left join public.source_fetch_runs sfr
          on sfr.source_id = fs.source_id
         and sfr.cycle_date = pr.cycle_date
        where fs.flow_id = pr.flow_id
          and coalesce(sfr.status, 'pending') not in ('completed', 'failed')
      )
    for update of pr skip locked
  loop
    update public.processing_runs
    set processing_enqueued_at = now()
    where id = processing_rec.id
      and processing_enqueued_at is null;

    perform pgmq.send(
      'processing-queue',
      jsonb_build_object(
        'type', 'processing',
        'flow_id', processing_rec.flow_id,
        'cycle_date', processing_rec.cycle_date
      )
    );
    enqueued_count := enqueued_count + 1;
  end loop;

  return enqueued_count;
end;
$$ language plpgsql;

revoke execute on function public.enqueue_ready_processing_runs(uuid, date) from public;
grant execute on function public.enqueue_ready_processing_runs(uuid, date) to service_role, postgres;

create or replace function public.complete_worker_job(
  p_queue_name text,
  p_msg_id bigint,
  p_job_type text,
  p_source_id uuid default null,
  p_flow_id uuid default null,
  p_attempt_id uuid default null,
  p_cycle_date date default null
)
returns jsonb as $$
declare
  affected_rows integer := 0;
  deleted boolean := false;
begin
  perform public.validate_worker_queue_name(p_queue_name);

  if p_job_type = 'ingestion' then
    update public.source_fetch_runs
    set status = 'completed', completed_at = now(), error_code = null
    where source_id = p_source_id and cycle_date = p_cycle_date;
    get diagnostics affected_rows = row_count;

    perform public.enqueue_ready_processing_runs(p_source_id, p_cycle_date);
  elsif p_job_type = 'processing' then
    update public.processing_runs
    set status = case when status = 'no_content' then 'no_content' else 'completed' end,
        completed_at = now(),
        error_code = null
    where flow_id = p_flow_id and cycle_date = p_cycle_date;
    get diagnostics affected_rows = row_count;
  elsif p_job_type = 'delivery' then
    update public.digest_delivery_attempts
    set status = 'delivered', attempted_at = coalesce(attempted_at, now()), locked_at = null, error_message = null
    where id = p_attempt_id;
    get diagnostics affected_rows = row_count;
  else
    raise exception 'Unsupported job type: %', p_job_type using errcode = 'invalid_parameter_value';
  end if;

  if affected_rows <> 1 then
    raise exception 'Expected one domain row for %, updated %', p_job_type, affected_rows using errcode = 'no_data_found';
  end if;

  deleted := pgmq.delete(p_queue_name, p_msg_id);
  if deleted is not true then
    raise exception 'Queue acknowledgement failed for % message %', p_queue_name, p_msg_id using errcode = 'object_not_in_prerequisite_state';
  end if;

  return jsonb_build_object('updated_rows', affected_rows, 'acknowledged', true);
end;
$$ language plpgsql;

create or replace function public.fail_worker_job(
  p_job_type text,
  p_error_message text,
  p_source_id uuid default null,
  p_flow_id uuid default null,
  p_attempt_id uuid default null,
  p_cycle_date date default null
)
returns jsonb as $$
declare
  affected_rows integer := 0;
begin
  if p_job_type = 'ingestion' then
    update public.source_fetch_runs
    set status = 'failed', error_code = left(p_error_message, 500), completed_at = now()
    where source_id = p_source_id and cycle_date = p_cycle_date;
    get diagnostics affected_rows = row_count;

    perform public.enqueue_ready_processing_runs(p_source_id, p_cycle_date);
  elsif p_job_type = 'processing' then
    update public.processing_runs
    set status = 'failed', error_code = left(p_error_message, 500), completed_at = now()
    where flow_id = p_flow_id and cycle_date = p_cycle_date;
    get diagnostics affected_rows = row_count;
  elsif p_job_type = 'delivery' then
    update public.digest_delivery_attempts
    set status = 'failed', error_message = left(p_error_message, 500), locked_at = null,
        retry_count = retry_count + 1,
        next_attempt_at = now() + interval '5 minutes'
    where id = p_attempt_id;
    get diagnostics affected_rows = row_count;
  else
    raise exception 'Unsupported job type: %', p_job_type using errcode = 'invalid_parameter_value';
  end if;

  return jsonb_build_object('updated_rows', affected_rows, 'acknowledged', false);
end;
$$ language plpgsql;

create or replace function public.archive_exhausted_worker_job(
  p_queue_name text,
  p_msg_id bigint,
  p_event_key text,
  p_context jsonb
)
returns jsonb as $$
declare
  event_id uuid;
  archived boolean := false;
  failed_processing_run_id uuid;
begin
  perform public.validate_worker_queue_name(p_queue_name);
  archived := pgmq.archive(p_queue_name, p_msg_id);
  if archived is not true then
    raise exception 'Queue archive failed for % message %', p_queue_name, p_msg_id using errcode = 'object_not_in_prerequisite_state';
  end if;

  if p_context ->> 'type' = 'processing' then
    select id into failed_processing_run_id
    from public.processing_runs
    where flow_id = nullif(p_context ->> 'flow_id', '')::uuid
      and cycle_date = nullif(p_context ->> 'cycle_date', '')::date;

    if failed_processing_run_id is not null and not exists (
      select 1
      from public.processed_digests
      where processing_run_id = failed_processing_run_id
    ) then
      delete from public.flow_articles
      where processing_run_id = failed_processing_run_id
        and digest_id is null;
    end if;
  end if;

  event_id := public.log_operational_event(
    'critical',
    'dlq_exhaustion',
    p_event_key,
    p_context
  );
  return jsonb_build_object('archived', true, 'event_id', event_id);
end;
$$ language plpgsql;

create or replace function public.persist_processing_digest(
  p_digest_id uuid,
  p_flow_id uuid,
  p_processing_run_id uuid,
  p_content jsonb,
  p_token_usage integer,
  p_provider_request_id text,
  p_model text
)
returns uuid as $$
declare
  existing_id uuid;
  included_rows integer := 0;
begin
  select id into existing_id
  from public.processed_digests
  where processing_run_id = p_processing_run_id
  for update;

  if existing_id is null then
    insert into public.processed_digests (
      id,
      flow_id,
      processing_run_id,
      content,
      token_usage,
      provider_request_id,
      model
    )
    values (
      p_digest_id,
      p_flow_id,
      p_processing_run_id,
      p_content,
      p_token_usage,
      p_provider_request_id,
      p_model
    )
    returning id into existing_id;
  end if;

  update public.flow_articles
  set status = 'included',
      digest_id = existing_id
  where flow_id = p_flow_id
    and processing_run_id = p_processing_run_id
    and status in ('claimed', 'included');
  get diagnostics included_rows = row_count;

  if included_rows < 1 then
    raise exception 'Expected at least one claimed article for processing run %', p_processing_run_id
      using errcode = 'no_data_found';
  end if;

  return existing_id;
end;
$$ language plpgsql;

revoke execute on function public.persist_processing_digest(uuid, uuid, uuid, jsonb, integer, text, text) from public;
grant execute on function public.persist_processing_digest(uuid, uuid, uuid, jsonb, integer, text, text) to service_role, postgres;
