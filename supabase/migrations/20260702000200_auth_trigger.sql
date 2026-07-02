-- Auth Trigger Migration: Auto-create profile and default delivery channels
-- Upstream decisions: BR-USER-01, T-06, NFR-SEC-01

-- handle_new_user: SECURITY DEFINER because it fires on auth.users (schema
-- the user doesn't own) and must insert into public.profiles and
-- public.delivery_channels bypassing RLS. Safe because it only runs as an
-- AFTER INSERT trigger on auth.users, controlled by Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Create user profile idempotently
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- Create default in-app delivery channel (always active, no verification needed)
  if not exists (
    select 1 from public.delivery_channels
    where user_id = new.id and type = 'in-app'
  ) then
    insert into public.delivery_channels (user_id, type, status)
    values (new.id, 'in-app', 'active');
  end if;

  -- Create email delivery channel
  if not exists (
    select 1 from public.delivery_channels
    where user_id = new.id and type = 'email'
  ) then
    insert into public.delivery_channels (user_id, type, status, verified_at, config)
    values (
      new.id,
      'email',
      case when new.email_confirmed_at is not null then 'active' else 'pending' end,
      case when new.email_confirmed_at is not null then new.email_confirmed_at else null end,
      jsonb_build_object('email', new.email)
    );
  end if;

  return new;
end;
$$;

-- handle_user_update: SECURITY DEFINER because it fires on auth.users updates
-- and updates public.delivery_channels status to active once email is confirmed,
-- and syncs email address updates to profiles and delivery channels config.
create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- 1. Sync email updates to the profile table
  if old.email is distinct from new.email then
    update public.profiles
    set email = new.email
    where id = new.id;
  end if;

  -- 2. Sync email config and confirm status on delivery channels
  if old.email is distinct from new.email or old.email_confirmed_at is distinct from new.email_confirmed_at then
    -- Step A: Sync config. This will trigger tr_delivery_channels_verification
    -- to reset status = 'pending' and verified_at = null if config changed.
    update public.delivery_channels
    set config = jsonb_build_object('email', new.email)
    where user_id = new.id and type = 'email';

    -- Step B: If email is confirmed, activate/restore the channel.
    -- This second update does not change config, so the verification trigger
    -- is not bypassed but we explicitly set it to active when confirmed.
    if new.email_confirmed_at is not null then
      update public.delivery_channels
      set status = 'active',
          verified_at = new.email_confirmed_at
      where user_id = new.id and type = 'email';
    end if;
  end if;

  return new;
end;
$$;

-- Revoke execute from public to ensure least privilege
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_user_update() from public;

-- Trigger for user creation
create or replace trigger tr_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger for user updates (e.g. email confirmation or update)
create or replace trigger tr_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_update();
