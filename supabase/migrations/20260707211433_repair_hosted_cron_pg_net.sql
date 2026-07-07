-- Repair hosted cron invocation dependencies and endpoint configuration.
-- pg_cron invokes Edge Functions through pg_net, which owns net.http_post.
create extension if not exists pg_net with schema extensions;

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
  $$ select net.http_post(
       url := rtrim(
         coalesce(nullif(current_setting('app.settings.supabase_url', true), ''), 'http://kong:8000'),
         '/'
       ) || '/functions/v1/schedule-daily',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
       ),
       body := '{}'::jsonb
     ) $$
);

select cron.schedule(
  'worker-drain-job',
  '* * * * *',
  $$ select net.http_post(
       url := rtrim(
         coalesce(nullif(current_setting('app.settings.supabase_url', true), ''), 'http://kong:8000'),
         '/'
       ) || '/functions/v1/work',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
       ),
       body := '{}'::jsonb
     ) $$
);

select cron.schedule(
  'cleanup-job',
  '*/30 * * * *',
  $$ select net.http_post(
       url := rtrim(
         coalesce(nullif(current_setting('app.settings.supabase_url', true), ''), 'http://kong:8000'),
         '/'
       ) || '/functions/v1/cleanup',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), '')
       ),
       body := '{}'::jsonb
     ) $$
);
