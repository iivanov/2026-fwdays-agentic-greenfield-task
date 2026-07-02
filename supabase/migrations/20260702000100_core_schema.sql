-- Core Schema Migration for AI-Powered Personalized News Aggregator
-- Upstream decisions: D-01..06, A-02, NFR-SEC-02

-- 0. Shared Trigger Functions
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. Profiles Table (Linked to Supabase Auth Users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  interests text[] default '{}'::text[] not null,
  language_preferences text[] default '{}'::text[] not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create trigger tr_profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();


-- 2. Delivery Channels Table
create table public.delivery_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('in-app', 'email', 'telegram', 'slack', 'webhook')),
  status text default 'pending' not null check (status in ('pending', 'active', 'disabled')),
  config jsonb default '{}'::jsonb not null,
  verified_at timestamp with time zone,
  consecutive_failure_count integer default 0 not null,
  last_error_code text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Index for foreign keys
create index delivery_channels_user_id_idx on public.delivery_channels (user_id);

-- Enable RLS
alter table public.delivery_channels enable row level security;

-- Policies for delivery_channels
create policy "Users can select own delivery channels" on public.delivery_channels
  for select using (auth.uid() = user_id);

create policy "Users can insert own delivery channels" on public.delivery_channels
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and verified_at is null
    and consecutive_failure_count = 0
    and last_error_code is null
  );

create policy "Users can update own delivery channels" on public.delivery_channels
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own delivery channels" on public.delivery_channels
  for delete using (auth.uid() = user_id);

-- Triggers for delivery_channels
create trigger tr_delivery_channels_updated_at before update on public.delivery_channels
  for each row execute function public.handle_updated_at();

create or replace function public.handle_delivery_channel_verification()
returns trigger as $$
begin
  if old.type is distinct from new.type or old.config is distinct from new.config then
    new.status = 'pending';
    new.verified_at = null;
    new.consecutive_failure_count = 0;
    new.last_error_code = null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tr_delivery_channels_verification before update on public.delivery_channels
  for each row execute function public.handle_delivery_channel_verification();


-- 3. Global Sources Table
create table public.global_sources (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  type text not null check (type in ('rss', 'atom', 'web')),
  status text default 'active' not null check (status in ('active', 'paused')),
  failed_fetch_count integer default 0 not null,
  last_fetched_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.global_sources enable row level security;

-- Policies for global_sources
create policy "Authenticated users can select global sources" on public.global_sources
  for select using (auth.role() = 'authenticated');


-- 4. Processing Flows Table
create table public.processing_flows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  frequency text default 'daily' not null check (frequency in ('daily')),
  ai_model text default 'gpt-5.4-mini' not null check (ai_model in ('gpt-5.4-mini')),
  prompt_type text default 'predefined' not null check (prompt_type in ('predefined', 'custom')),
  prompt_template text,
  is_enabled boolean default true not null,
  next_run_at timestamp with time zone not null,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Index for foreign keys
create index processing_flows_user_id_idx on public.processing_flows (user_id);

-- Enable RLS
alter table public.processing_flows enable row level security;

-- Policies for processing_flows
create policy "Users can select own processing flows" on public.processing_flows
  for select using (auth.uid() = user_id);

create policy "Users can insert own processing flows" on public.processing_flows
  for insert with check (auth.uid() = user_id);

create policy "Users can update own processing flows" on public.processing_flows
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own processing flows" on public.processing_flows
  for delete using (auth.uid() = user_id);

-- Triggers for processing_flows
create trigger tr_processing_flows_updated_at before update on public.processing_flows
  for each row execute function public.handle_updated_at();

create or replace function public.get_next_0600_utc()
returns timestamp with time zone as $$
declare
  now_utc timestamp with time zone;
  today_0600 timestamp with time zone;
begin
  now_utc := now();
  today_0600 := (date_trunc('day', now() at time zone 'utc') + interval '6 hours') at time zone 'utc';
  if now_utc < today_0600 then
    return today_0600;
  else
    return today_0600 + interval '1 day';
  end if;
end;
$$ language plpgsql;

create or replace function public.check_processing_flow_quota()
returns trigger as $$
declare
  flow_count integer;
begin
  -- Acquire an exclusive row lock on the user's profile to serialize quota checks
  perform 1
  from public.profiles
  where id = new.user_id
  for update;

  select count(*) into flow_count
  from public.processing_flows
  where user_id = new.user_id;

  if flow_count >= 5 then
    raise exception 'User exceeds the maximum quota of 5 processing flows'
      using errcode = 'raise_exception';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tr_processing_flows_quota before insert on public.processing_flows
  for each row execute function public.check_processing_flow_quota();

create or replace function public.handle_processing_flow_scheduling()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.next_run_at = public.get_next_0600_utc();
    new.last_run_at = null;
  elsif tg_op = 'UPDATE' then
    if auth.role() = 'authenticated' then
      new.next_run_at = old.next_run_at;
      new.last_run_at = old.last_run_at;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tr_processing_flows_scheduling before insert or update on public.processing_flows
  for each row execute function public.handle_processing_flow_scheduling();


-- 5. Flow Sources Join Table
create table public.flow_sources (
  flow_id uuid references public.processing_flows(id) on delete cascade not null,
  source_id uuid references public.global_sources(id) on delete cascade not null,
  primary key (flow_id, source_id)
);

-- Index for source queries
create index flow_sources_source_id_idx on public.flow_sources (source_id);

-- Enable RLS
alter table public.flow_sources enable row level security;

-- Policies for flow_sources
create policy "Users can manage own flow sources" on public.flow_sources
  for all using (
    exists (
      select 1 from public.processing_flows f
      where f.id = flow_id and f.user_id = auth.uid()
    )
  );


-- 6. Flow Delivery Channels Join Table
create table public.flow_delivery_channels (
  flow_id uuid references public.processing_flows(id) on delete cascade not null,
  channel_id uuid references public.delivery_channels(id) on delete cascade not null,
  primary key (flow_id, channel_id)
);

-- Index for channel queries
create index flow_delivery_channels_channel_id_idx on public.flow_delivery_channels (channel_id);

-- Enable RLS
alter table public.flow_delivery_channels enable row level security;

-- Policies for flow_delivery_channels
create policy "Users can manage own flow delivery channels" on public.flow_delivery_channels
  for all using (
    exists (
      select 1 from public.processing_flows f
      where f.id = flow_id and f.user_id = auth.uid()
    ) and
    exists (
      select 1 from public.delivery_channels c
      where c.id = channel_id and c.user_id = auth.uid()
    )
  );


-- 7. Ingested Articles Table
create table public.ingested_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.global_sources(id) on delete cascade not null,
  external_guid text,
  title text not null,
  url text not null,
  content text not null,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

-- Index for foreign keys
create index ingested_articles_source_id_idx on public.ingested_articles (source_id);

-- Uniqueness rules
create unique index ingested_articles_source_guid_idx on public.ingested_articles (source_id, external_guid) where external_guid is not null;

create or replace function public.check_article_uniqueness()
returns trigger as $$
begin
  if new.external_guid is not null then
    if exists (
      select 1 from public.ingested_articles
      where source_id = new.source_id and external_guid = new.external_guid and id <> new.id
    ) then
      raise exception 'Duplicate article GUID: %', new.external_guid
        using errcode = 'unique_violation';
    end if;
  end if;

  if new.external_guid is null then
    if exists (
      select 1 from public.ingested_articles
      where source_id = new.source_id and url = new.url and id <> new.id
    ) then
      raise exception 'Duplicate article URL: %', new.url
        using errcode = 'unique_violation';
    end if;
  else
    if exists (
      select 1 from public.ingested_articles
      where source_id = new.source_id and url = new.url and external_guid is null and id <> new.id
    ) then
      raise exception 'Duplicate article URL (existing item lacks GUID): %', new.url
        using errcode = 'unique_violation';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger tr_ingested_articles_uniqueness before insert or update on public.ingested_articles
  for each row execute function public.check_article_uniqueness();

-- Enable RLS
alter table public.ingested_articles enable row level security;

-- Policies for ingested_articles
create policy "Authenticated users can select ingested articles" on public.ingested_articles
  for select using (auth.role() = 'authenticated');


-- 8. Source Item Fingerprints Table
create table public.source_item_fingerprints (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.global_sources(id) on delete cascade not null,
  guid_hash text,
  url_hash text not null,
  first_seen_at timestamp with time zone default now() not null
);

-- Index for foreign keys
create index source_item_fingerprints_source_id_idx on public.source_item_fingerprints (source_id);

-- Uniqueness rules
create unique index source_item_fingerprints_source_guid_idx on public.source_item_fingerprints (source_id, guid_hash) where guid_hash is not null;

create or replace function public.check_fingerprint_uniqueness()
returns trigger as $$
begin
  if new.guid_hash is not null then
    if exists (
      select 1 from public.source_item_fingerprints
      where source_id = new.source_id and guid_hash = new.guid_hash and id <> new.id
    ) then
      raise exception 'Duplicate fingerprint GUID hash'
        using errcode = 'unique_violation';
    end if;
  end if;

  if new.guid_hash is null then
    if exists (
      select 1 from public.source_item_fingerprints
      where source_id = new.source_id and url_hash = new.url_hash and id <> new.id
    ) then
      raise exception 'Duplicate fingerprint URL hash'
        using errcode = 'unique_violation';
    end if;
  else
    if exists (
      select 1 from public.source_item_fingerprints
      where source_id = new.source_id and url_hash = new.url_hash and guid_hash is null and id <> new.id
    ) then
      raise exception 'Duplicate fingerprint URL hash (existing lacks GUID hash)'
        using errcode = 'unique_violation';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger tr_source_item_fingerprints_uniqueness before insert or update on public.source_item_fingerprints
  for each row execute function public.check_fingerprint_uniqueness();

-- Enable RLS (Deny-by-default for users)
alter table public.source_item_fingerprints enable row level security;


-- 9. Source Fetch Runs Table
create table public.source_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.global_sources(id) on delete cascade not null,
  cycle_date date not null,
  status text default 'pending' not null check (status in ('pending', 'processing', 'completed', 'failed')),
  error_code text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  unique (source_id, cycle_date)
);

-- Enable RLS (Deny-by-default for users)
alter table public.source_fetch_runs enable row level security;


-- 10. Processing Runs Table
create table public.processing_runs (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid references public.processing_flows(id) on delete cascade not null,
  cycle_date date not null,
  status text default 'pending' not null check (status in ('pending', 'processing', 'completed', 'no_content', 'failed')),
  error_code text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  unique (flow_id, cycle_date)
);

-- Enable RLS (Deny-by-default for users)
alter table public.processing_runs enable row level security;

-- Policies for processing_runs
create policy "Users can select own processing runs" on public.processing_runs
  for select using (
    exists (
      select 1 from public.processing_flows f
      where f.id = flow_id and f.user_id = auth.uid()
    )
  );


-- 11. Processed Digests Table
create table public.processed_digests (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid references public.processing_flows(id) on delete cascade not null,
  processing_run_id uuid references public.processing_runs(id) on delete cascade unique not null,
  content jsonb not null,
  token_usage integer not null,
  provider_request_id text,
  model text not null,
  user_feedback text default 'none' not null check (user_feedback in ('thumbs_up', 'thumbs_down', 'none')),
  created_at timestamp with time zone default now() not null
);

-- Index for foreign keys
create index processed_digests_flow_id_idx on public.processed_digests (flow_id);

-- Enable RLS
alter table public.processed_digests enable row level security;

-- Policies for processed_digests
create policy "Users can view own processed digests" on public.processed_digests
  for select using (
    exists (
      select 1 from public.processing_flows f
      where f.id = flow_id and f.user_id = auth.uid()
    )
  );

create policy "Users can update own processed digests feedback" on public.processed_digests
  for update using (
    exists (
      select 1 from public.processing_flows f
      where f.id = flow_id and f.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.processing_flows f
      where f.id = flow_id and f.user_id = auth.uid()
    )
  );


-- 12. Flow Articles Table (Join Table for Claimed Articles)
create table public.flow_articles (
  flow_id uuid references public.processing_flows(id) on delete cascade not null,
  article_id uuid references public.ingested_articles(id) on delete cascade not null,
  processing_run_id uuid references public.processing_runs(id) on delete cascade not null,
  digest_id uuid references public.processed_digests(id) on delete set null,
  status text default 'claimed' not null check (status in ('claimed', 'included', 'filtered')),
  claimed_at timestamp with time zone default now() not null,
  primary key (flow_id, article_id)
);

-- Index for runs queries
create index flow_articles_run_id_idx on public.flow_articles (processing_run_id);
create index flow_articles_digest_id_idx on public.flow_articles (digest_id);
create index flow_articles_article_id_idx on public.flow_articles (article_id);

-- Enable RLS
alter table public.flow_articles enable row level security;

-- Policies for flow_articles
create policy "Users can view own flow articles" on public.flow_articles
  for select using (
    exists (
      select 1 from public.processing_flows f
      where f.id = flow_id and f.user_id = auth.uid()
    )
  );


-- 13. Digest Delivery Attempts Table
create table public.digest_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  digest_id uuid references public.processed_digests(id) on delete cascade not null,
  channel_id uuid references public.delivery_channels(id) on delete set null,
  status text default 'pending' not null check (status in ('pending', 'sending', 'delivered', 'failed')),
  error_message text,
  attempted_at timestamp with time zone,
  locked_at timestamp with time zone,
  retry_count integer default 0 not null,
  next_attempt_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  unique (digest_id, channel_id)
);

-- Index for channel queries
create index digest_delivery_attempts_channel_idx on public.digest_delivery_attempts (channel_id);

-- Enable RLS
alter table public.digest_delivery_attempts enable row level security;

-- Policies for digest_delivery_attempts
create policy "Users can view own digest delivery attempts" on public.digest_delivery_attempts
  for select using (
    exists (
      select 1 from public.processed_digests d
      join public.processing_flows f on f.id = d.flow_id
      where d.id = digest_id and f.user_id = auth.uid()
    )
  );


-- 14. Operational Events Table
create table public.operational_events (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('warning', 'critical')),
  category text not null,
  deduplication_key text not null,
  context jsonb default '{}'::jsonb not null,
  occurrence_count integer default 1 not null,
  first_seen_at timestamp with time zone default now() not null,
  last_seen_at timestamp with time zone default now() not null,
  alerted_at timestamp with time zone,
  resolved_at timestamp with time zone
);

-- Constraint: At most one unresolved row per deduplication_key
create unique index operational_events_unresolved_idx on public.operational_events (deduplication_key) where resolved_at is null;

-- Enable RLS (Deny-by-default for users)
alter table public.operational_events enable row level security;


-- 15. Integration Circuit Breaker Table
create table public.integration_circuits (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('ai_provider', 'email_provider', 'telegram', 'slack', 'webhook_origin')),
  scope_key text not null,
  state text default 'closed' not null check (state in ('closed', 'open', 'half_open')),
  consecutive_failure_count integer default 0 not null,
  opened_at timestamp with time zone,
  next_probe_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  unique (scope_type, scope_key)
);

-- Enable RLS (Deny-by-default for users)
alter table public.integration_circuits enable row level security;

-- Trigger for integration_circuits
create trigger tr_integration_circuits_updated_at before update on public.integration_circuits
  for each row execute function public.handle_updated_at();

-- 16. Grant permissions on tables to authenticated and service_role roles
-- service_role gets full access on all tables
grant all on table public.profiles to service_role;
grant all on table public.delivery_channels to service_role;
grant all on table public.global_sources to service_role;
grant all on table public.processing_flows to service_role;
grant all on table public.flow_sources to service_role;
grant all on table public.flow_delivery_channels to service_role;
grant all on table public.ingested_articles to service_role;
grant all on table public.source_item_fingerprints to service_role;
grant all on table public.source_fetch_runs to service_role;
grant all on table public.processing_runs to service_role;
grant all on table public.processed_digests to service_role;
grant all on table public.flow_articles to service_role;
grant all on table public.digest_delivery_attempts to service_role;
grant all on table public.operational_events to service_role;
grant all on table public.integration_circuits to service_role;

-- authenticated role gets limited access based on user-facing functionality
grant select, insert, delete on table public.profiles to authenticated;
grant update(interests, language_preferences) on table public.profiles to authenticated;

grant select, insert, delete on table public.delivery_channels to authenticated;
grant update(type, config) on table public.delivery_channels to authenticated;

grant select, insert, delete on table public.processing_flows to authenticated;
grant update(name, frequency, ai_model, prompt_type, prompt_template, is_enabled) on table public.processing_flows to authenticated;

grant select, insert, delete on table public.flow_sources to authenticated;
grant select, insert, delete on table public.flow_delivery_channels to authenticated;

grant select on table public.global_sources to authenticated;
grant select on table public.ingested_articles to authenticated;

grant select on table public.processed_digests to authenticated;
grant update(user_feedback) on table public.processed_digests to authenticated;

grant select on table public.flow_articles to authenticated;
grant select on table public.digest_delivery_attempts to authenticated;
grant select on table public.processing_runs to authenticated;


