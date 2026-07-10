-- Hosted cron must not depend on mutable database settings or local Docker URLs.
-- Supabase Vault holds per-project scheduler configuration outside migrations.
create extension if not exists supabase_vault with schema vault;

create schema if not exists private;

create or replace function private.invoke_scheduled_edge_function(p_path text)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, vault, net
as $$
declare
  project_url text;
  scheduler_secret text;
begin
  if p_path not in (
    '/functions/v1/schedule-daily',
    '/functions/v1/work',
    '/functions/v1/cleanup'
  ) then
    raise exception 'Unsupported scheduled Edge Function path';
  end if;

  select decrypted_secret
  into project_url
  from vault.decrypted_secrets
  where name = 'news_aggregator_cron_project_url';

  if coalesce(project_url, '') = '' then
    raise exception 'Missing Vault secret: news_aggregator_cron_project_url';
  end if;

  select decrypted_secret
  into scheduler_secret
  from vault.decrypted_secrets
  where name = 'news_aggregator_cron_scheduler_secret';

  if coalesce(scheduler_secret, '') = '' then
    raise exception 'Missing Vault secret: news_aggregator_cron_scheduler_secret';
  end if;

  return net.http_post(
    url := rtrim(project_url, '/') || p_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || scheduler_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function private.invoke_scheduled_edge_function(text) from public;
grant execute on function private.invoke_scheduled_edge_function(text) to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'schedule-daily-job') then
    perform cron.unschedule('schedule-daily-job');
  end if;

  if exists (select 1 from cron.job where jobname = 'worker-drain-job') then
    perform cron.unschedule('worker-drain-job');
  end if;

  if exists (select 1 from cron.job where jobname = 'cleanup-job') then
    perform cron.unschedule('cleanup-job');
  end if;
end;
$$;

select cron.schedule(
  'schedule-daily-job',
  '0 6 * * *',
  $$ select private.invoke_scheduled_edge_function('/functions/v1/schedule-daily') $$
);

select cron.schedule(
  'worker-drain-job',
  '* * * * *',
  $$ select private.invoke_scheduled_edge_function('/functions/v1/work') $$
);

select cron.schedule(
  'cleanup-job',
  '*/30 * * * *',
  $$ select private.invoke_scheduled_edge_function('/functions/v1/cleanup') $$
);
