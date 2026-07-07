drop function if exists public.schedule_daily_flows(boolean);

create or replace function public.schedule_daily_flows(p_force boolean default false)
returns jsonb as $$
declare
  flow_rec record;
  source_rec record;
  enqueued_count integer := 0;
  flows_processed integer := 0;
  skipped_existing_cycle_count integer := 0;
  active_flow_count integer := 0;
  due_flow_count integer := 0;
  skipped_not_due_count integer := 0;
  source_runs_reused_count integer := 0;
  source_runs_completed_count integer := 0;
  cycle_dt date;
  run_now timestamp with time zone := now();
  today_utc date := (now() at time zone 'utc')::date;
  next_due_at timestamp with time zone;
  flow_is_due boolean;
  should_advance_schedule boolean;
  processing_run_id uuid;
  source_run_inserted boolean;
  source_run_status text;
begin
  select
    count(*),
    count(*) filter (where next_run_at <= run_now),
    min(next_run_at)
  into active_flow_count, due_flow_count, next_due_at
  from public.processing_flows
  where is_enabled = true;

  if not p_force then
    skipped_not_due_count := active_flow_count - due_flow_count;
  end if;

  for flow_rec in
    select id, next_run_at, user_id
    from public.processing_flows
    where is_enabled = true
      and (p_force = true or next_run_at <= run_now)
    order by next_run_at asc
    for update
  loop
    flow_is_due := flow_rec.next_run_at <= run_now;
    cycle_dt := case
      when p_force = true and flow_is_due = false then today_utc
      else flow_rec.next_run_at::date
    end;
    should_advance_schedule := flow_is_due or flow_rec.next_run_at::date <= cycle_dt;
    processing_run_id := null;

    insert into public.processing_runs (flow_id, cycle_date, status)
    values (flow_rec.id, cycle_dt, 'pending')
    on conflict (flow_id, cycle_date) do nothing
    returning id into processing_run_id;

    if processing_run_id is null then
      skipped_existing_cycle_count := skipped_existing_cycle_count + 1;

      select id into processing_run_id
      from public.processing_runs
      where flow_id = flow_rec.id
        and cycle_date = cycle_dt;
    else
      flows_processed := flows_processed + 1;
    end if;

    if should_advance_schedule then
      update public.processing_flows
      set last_run_at = case
            when flow_is_due then flow_rec.next_run_at
            else run_now
          end,
          next_run_at = flow_rec.next_run_at + interval '1 day',
          updated_at = now()
      where id = flow_rec.id;
    else
      update public.processing_flows
      set last_run_at = run_now,
          updated_at = now()
      where id = flow_rec.id;
    end if;

    for source_rec in
      select source_id
      from public.flow_sources
      where flow_id = flow_rec.id
    loop
      source_run_inserted := false;
      source_run_status := null;

      insert into public.source_fetch_runs (source_id, cycle_date, status)
      values (source_rec.source_id, cycle_dt, 'pending')
      on conflict (source_id, cycle_date) do nothing
      returning true into source_run_inserted;

      if coalesce(source_run_inserted, false) = false then
        select status into source_run_status
        from public.source_fetch_runs
        where source_id = source_rec.source_id
          and cycle_date = cycle_dt;

        if source_run_status in ('completed', 'processing') then
          source_runs_completed_count := source_runs_completed_count + 1;
          continue;
        end if;

        if p_force then
          update public.source_fetch_runs
          set status = 'pending',
              error_code = null,
              started_at = null,
              completed_at = null
          where source_id = source_rec.source_id
            and cycle_date = cycle_dt
            and status in ('pending', 'failed');

          source_runs_reused_count := source_runs_reused_count + 1;
        else
          continue;
        end if;
      end if;

      perform pgmq.send(
        'ingestion-queue',
        jsonb_build_object(
          'type', 'ingestion',
          'source_id', source_rec.source_id,
          'cycle_date', cycle_dt
        )
      );
      enqueued_count := enqueued_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'force', p_force,
    'active_flows', active_flow_count,
    'due_flows', due_flow_count,
    'skipped_not_due', skipped_not_due_count,
    'skipped_existing_cycle', skipped_existing_cycle_count,
    'source_runs_reused', source_runs_reused_count,
    'source_runs_already_active', source_runs_completed_count,
    'flows_processed', flows_processed,
    'jobs_enqueued', enqueued_count,
    'next_due_at', next_due_at
  );
end;
$$ language plpgsql;

revoke execute on function public.schedule_daily_flows(boolean) from public;
grant execute on function public.schedule_daily_flows(boolean) to service_role, postgres;
