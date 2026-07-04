-- R-11F: transactional worker acknowledgement and DLQ helpers

create or replace function public.validate_worker_queue_name(p_queue_name text)
returns void as $$
begin
  if p_queue_name not in ('ingestion-queue', 'processing-queue', 'delivery-queue') then
    raise exception 'Unsupported queue name: %', p_queue_name using errcode = 'invalid_parameter_value';
  end if;
end;
$$ language plpgsql;

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
  elsif p_job_type = 'processing' then
    update public.processing_runs
    set status = 'completed', completed_at = now(), error_code = null
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
begin
  perform public.validate_worker_queue_name(p_queue_name);
  archived := pgmq.archive(p_queue_name, p_msg_id);
  if archived is not true then
    raise exception 'Queue archive failed for % message %', p_queue_name, p_msg_id using errcode = 'object_not_in_prerequisite_state';
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

revoke execute on function public.validate_worker_queue_name(text) from public;
revoke execute on function public.complete_worker_job(text, bigint, text, uuid, uuid, uuid, date) from public;
revoke execute on function public.fail_worker_job(text, text, uuid, uuid, uuid, date) from public;
revoke execute on function public.archive_exhausted_worker_job(text, bigint, text, jsonb) from public;

grant execute on function public.validate_worker_queue_name(text) to service_role, postgres;
grant execute on function public.complete_worker_job(text, bigint, text, uuid, uuid, uuid, date) to service_role, postgres;
grant execute on function public.fail_worker_job(text, text, uuid, uuid, uuid, date) to service_role, postgres;
grant execute on function public.archive_exhausted_worker_job(text, bigint, text, jsonb) to service_role, postgres;
