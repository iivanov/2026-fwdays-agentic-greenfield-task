drop function if exists public.schedule_daily_flows();
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
  cycle_dt date;
  run_now timestamp with time zone := now();
  today_utc date := (now() at time zone 'utc')::date;
  next_due_at timestamp with time zone;
  flow_is_due boolean;
  should_advance_schedule boolean;
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

    begin
      insert into public.processing_runs (flow_id, cycle_date, status)
      values (flow_rec.id, cycle_dt, 'pending');
    exception when unique_violation then
      skipped_existing_cycle_count := skipped_existing_cycle_count + 1;

      if should_advance_schedule then
        update public.processing_flows
        set last_run_at = coalesce(last_run_at, flow_rec.next_run_at),
            next_run_at = flow_rec.next_run_at + interval '1 day',
            updated_at = now()
        where id = flow_rec.id;
      end if;

      continue;
    end;

    flows_processed := flows_processed + 1;

    update public.processing_flows
    set last_run_at = case
          when flow_is_due then flow_rec.next_run_at
          else run_now
        end,
        next_run_at = case
          when should_advance_schedule then flow_rec.next_run_at + interval '1 day'
          else flow_rec.next_run_at
        end,
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
    'force', p_force,
    'active_flows', active_flow_count,
    'due_flows', due_flow_count,
    'skipped_not_due', skipped_not_due_count,
    'skipped_existing_cycle', skipped_existing_cycle_count,
    'flows_processed', flows_processed,
    'jobs_enqueued', enqueued_count,
    'next_due_at', next_due_at
  );
end;
$$ language plpgsql;

revoke execute on function public.schedule_daily_flows(boolean) from public;
grant execute on function public.schedule_daily_flows(boolean) to service_role, postgres;
