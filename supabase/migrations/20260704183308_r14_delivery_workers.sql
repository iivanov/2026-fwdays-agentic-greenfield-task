-- R-14: create and deliver digest attempts with provider backoff and
-- integration circuit state.

create or replace function public.enqueue_digest_delivery_attempts(p_digest_id uuid)
returns integer as $$
declare
  attempt_rec record;
  enqueued_count integer := 0;
begin
  for attempt_rec in
    with inserted as (
      insert into public.digest_delivery_attempts (digest_id, channel_id)
      select d.id, c.id
      from public.processed_digests d
      join public.flow_delivery_channels fdc on fdc.flow_id = d.flow_id
      join public.delivery_channels c on c.id = fdc.channel_id
      where d.id = p_digest_id
        and c.status = 'active'
      on conflict (digest_id, channel_id) do nothing
      returning id
    )
    select id from inserted
  loop
    perform pgmq.send(
      'delivery-queue',
      jsonb_build_object('type', 'delivery', 'attempt_id', attempt_rec.id)
    );
    enqueued_count := enqueued_count + 1;
  end loop;

  return enqueued_count;
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

  perform public.enqueue_digest_delivery_attempts(existing_id);

  return existing_id;
end;
$$ language plpgsql;

create or replace function public.claim_delivery_attempt(p_attempt_id uuid)
returns jsonb as $$
declare
  claimed_id uuid;
  current_status text;
  current_next_attempt_at timestamp with time zone;
begin
  update public.digest_delivery_attempts
  set status = 'sending',
      locked_at = now(),
      attempted_at = now()
  where id = p_attempt_id
    and status in ('pending', 'failed')
    and (next_attempt_at is null or next_attempt_at <= now())
  returning id into claimed_id;

  if claimed_id is not null then
    return jsonb_build_object('claimed', true, 'status', 'sending');
  end if;

  select status, next_attempt_at
  into current_status, current_next_attempt_at
  from public.digest_delivery_attempts
  where id = p_attempt_id;

  if current_status is null then
    raise exception 'Delivery attempt not found: %', p_attempt_id using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'claimed', false,
    'status', current_status,
    'next_attempt_at', current_next_attempt_at
  );
end;
$$ language plpgsql;

create or replace function public.claim_integration_circuit_probe(
  p_scope_type text,
  p_scope_key text
)
returns jsonb as $$
declare
  circuit_rec public.integration_circuits%rowtype;
begin
  if p_scope_type is null or p_scope_key is null then
    return jsonb_build_object('allowed', true, 'state', 'none');
  end if;

  select *
  into circuit_rec
  from public.integration_circuits
  where scope_type = p_scope_type
    and scope_key = p_scope_key
  for update;

  if not found then
    insert into public.integration_circuits (scope_type, scope_key)
    values (p_scope_type, p_scope_key);
    return jsonb_build_object('allowed', true, 'state', 'closed');
  end if;

  if circuit_rec.state = 'open' then
    if circuit_rec.next_probe_at is not null and circuit_rec.next_probe_at > now() then
      return jsonb_build_object(
        'allowed', false,
        'state', 'open',
        'next_probe_at', circuit_rec.next_probe_at
      );
    end if;

    update public.integration_circuits
    set state = 'half_open'
    where id = circuit_rec.id;
    return jsonb_build_object('allowed', true, 'state', 'half_open');
  end if;

  if circuit_rec.state = 'half_open' then
    return jsonb_build_object(
      'allowed', false,
      'state', 'half_open',
      'next_probe_at', circuit_rec.next_probe_at
    );
  end if;

  return jsonb_build_object('allowed', true, 'state', 'closed');
end;
$$ language plpgsql;

create or replace function public.complete_delivery_worker_job(
  p_queue_name text,
  p_msg_id bigint,
  p_attempt_id uuid,
  p_circuit_scope_type text default null,
  p_circuit_scope_key text default null
)
returns jsonb as $$
declare
  affected_rows integer := 0;
  deleted boolean := false;
begin
  perform public.validate_worker_queue_name(p_queue_name);

  update public.digest_delivery_attempts
  set status = 'delivered',
      attempted_at = coalesce(attempted_at, now()),
      locked_at = null,
      error_message = null,
      next_attempt_at = null
  where id = p_attempt_id;
  get diagnostics affected_rows = row_count;

  if affected_rows <> 1 then
    raise exception 'Expected one delivery attempt, updated %', affected_rows using errcode = 'no_data_found';
  end if;

  update public.delivery_channels c
  set consecutive_failure_count = 0,
      last_error_code = null
  from public.digest_delivery_attempts a
  where a.id = p_attempt_id
    and c.id = a.channel_id;

  if p_circuit_scope_type is not null and p_circuit_scope_key is not null then
    insert into public.integration_circuits (
      scope_type,
      scope_key,
      state,
      consecutive_failure_count,
      opened_at,
      next_probe_at
    )
    values (p_circuit_scope_type, p_circuit_scope_key, 'closed', 0, null, null)
    on conflict (scope_type, scope_key) do update
    set state = 'closed',
        consecutive_failure_count = 0,
        opened_at = null,
        next_probe_at = null;
  end if;

  deleted := pgmq.delete(p_queue_name, p_msg_id);
  if deleted is not true then
    raise exception 'Queue acknowledgement failed for % message %', p_queue_name, p_msg_id using errcode = 'object_not_in_prerequisite_state';
  end if;

  return jsonb_build_object('updated_rows', affected_rows, 'acknowledged', true);
end;
$$ language plpgsql;

create or replace function public.acknowledge_delivery_worker_job(
  p_queue_name text,
  p_msg_id bigint
)
returns jsonb as $$
declare
  deleted boolean := false;
begin
  perform public.validate_worker_queue_name(p_queue_name);

  deleted := pgmq.delete(p_queue_name, p_msg_id);
  if deleted is not true then
    raise exception 'Queue acknowledgement failed for % message %', p_queue_name, p_msg_id using errcode = 'object_not_in_prerequisite_state';
  end if;

  return jsonb_build_object('acknowledged', true);
end;
$$ language plpgsql;

create or replace function public.requeue_delivery_worker_job(
  p_queue_name text,
  p_msg_id bigint,
  p_attempt_id uuid,
  p_delay_seconds integer
)
returns jsonb as $$
declare
  deleted boolean := false;
  new_msg_id bigint;
begin
  perform public.validate_worker_queue_name(p_queue_name);

  deleted := pgmq.delete(p_queue_name, p_msg_id);
  if deleted is not true then
    raise exception 'Queue acknowledgement failed for % message %', p_queue_name, p_msg_id using errcode = 'object_not_in_prerequisite_state';
  end if;

  new_msg_id := pgmq.send(
    p_queue_name,
    jsonb_build_object('type', 'delivery', 'attempt_id', p_attempt_id),
    greatest(coalesce(p_delay_seconds, 0), 0)
  );

  return jsonb_build_object('acknowledged', true, 'requeued_msg_id', new_msg_id);
end;
$$ language plpgsql;

create or replace function public.record_delivery_failure_worker_job(
  p_queue_name text,
  p_msg_id bigint,
  p_attempt_id uuid,
  p_error_message text,
  p_retryable boolean,
  p_retry_after_seconds integer default null,
  p_circuit_scope_type text default null,
  p_circuit_scope_key text default null
)
returns jsonb as $$
declare
  affected_rows integer := 0;
  deleted boolean := false;
  failure_count integer := 0;
  retry_delay_seconds integer := 0;
begin
  perform public.validate_worker_queue_name(p_queue_name);

  if p_retryable then
    select greatest(
      coalesce(p_retry_after_seconds, 0),
      least(1800, (60 * power(2, least(retry_count, 5)))::integer)
    )
    into retry_delay_seconds
    from public.digest_delivery_attempts
    where id = p_attempt_id;

    update public.digest_delivery_attempts
    set status = 'failed',
        error_message = left(p_error_message, 500),
        locked_at = null,
        retry_count = retry_count + 1,
        next_attempt_at = now() + make_interval(secs => retry_delay_seconds)
    where id = p_attempt_id;
    get diagnostics affected_rows = row_count;
  else
    update public.digest_delivery_attempts
    set status = 'failed',
        error_message = left(p_error_message, 500),
        locked_at = null,
        retry_count = retry_count + 1,
        next_attempt_at = null
    where id = p_attempt_id;
    get diagnostics affected_rows = row_count;
  end if;

  if affected_rows <> 1 then
    raise exception 'Expected one delivery attempt, updated %', affected_rows using errcode = 'no_data_found';
  end if;

  update public.delivery_channels c
  set consecutive_failure_count = c.consecutive_failure_count + 1,
      last_error_code = left(p_error_message, 120),
      status = case when c.consecutive_failure_count + 1 >= 5 then 'disabled' else c.status end
  from public.digest_delivery_attempts a
  where a.id = p_attempt_id
    and c.id = a.channel_id
  returning c.consecutive_failure_count into failure_count;

  if p_retryable and p_circuit_scope_type is not null and p_circuit_scope_key is not null then
    insert into public.integration_circuits (
      scope_type,
      scope_key,
      state,
      consecutive_failure_count,
      opened_at,
      next_probe_at
    )
    values (p_circuit_scope_type, p_circuit_scope_key, 'closed', 1, null, null)
    on conflict (scope_type, scope_key) do update
    set consecutive_failure_count = public.integration_circuits.consecutive_failure_count + 1,
        state = case
          when public.integration_circuits.consecutive_failure_count + 1 >= 5 then 'open'
          else public.integration_circuits.state
        end,
        opened_at = case
          when public.integration_circuits.consecutive_failure_count + 1 >= 5 then now()
          else public.integration_circuits.opened_at
        end,
        next_probe_at = case
          when public.integration_circuits.consecutive_failure_count + 1 >= 5 then
            now() + make_interval(
              mins => least(
                60,
                (5 * power(2, greatest(public.integration_circuits.consecutive_failure_count - 4, 0)))::integer
              )
            )
          else public.integration_circuits.next_probe_at
        end;
  end if;

  if not p_retryable then
    deleted := pgmq.delete(p_queue_name, p_msg_id);
    if deleted is not true then
      raise exception 'Queue acknowledgement failed for % message %', p_queue_name, p_msg_id using errcode = 'object_not_in_prerequisite_state';
    end if;
  end if;

  return jsonb_build_object(
    'updated_rows', affected_rows,
    'acknowledged', not p_retryable,
    'channel_failure_count', failure_count
  );
end;
$$ language plpgsql;

revoke execute on function public.enqueue_digest_delivery_attempts(uuid) from public;
revoke execute on function public.persist_processing_digest(uuid, uuid, uuid, jsonb, integer, text, text) from public;
revoke execute on function public.claim_delivery_attempt(uuid) from public;
revoke execute on function public.claim_integration_circuit_probe(text, text) from public;
revoke execute on function public.complete_delivery_worker_job(text, bigint, uuid, text, text) from public;
revoke execute on function public.acknowledge_delivery_worker_job(text, bigint) from public;
revoke execute on function public.requeue_delivery_worker_job(text, bigint, uuid, integer) from public;
revoke execute on function public.record_delivery_failure_worker_job(text, bigint, uuid, text, boolean, integer, text, text) from public;

grant execute on function public.enqueue_digest_delivery_attempts(uuid) to service_role, postgres;
grant execute on function public.persist_processing_digest(uuid, uuid, uuid, jsonb, integer, text, text) to service_role, postgres;
grant execute on function public.claim_delivery_attempt(uuid) to service_role, postgres;
grant execute on function public.claim_integration_circuit_probe(text, text) to service_role, postgres;
grant execute on function public.complete_delivery_worker_job(text, bigint, uuid, text, text) to service_role, postgres;
grant execute on function public.acknowledge_delivery_worker_job(text, bigint) to service_role, postgres;
grant execute on function public.requeue_delivery_worker_job(text, bigint, uuid, integer) to service_role, postgres;
grant execute on function public.record_delivery_failure_worker_job(text, bigint, uuid, text, boolean, integer, text, text) to service_role, postgres;
