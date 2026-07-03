-- R-11C: custom prompts must not be readable or writable as plaintext through
-- the authenticated Data API. The Edge API uses the service role after JWT
-- authentication to encrypt/decrypt prompt_template values at the API boundary.

revoke select, insert, update on table public.processing_flows from authenticated;

grant select (
  id,
  user_id,
  name,
  frequency,
  ai_model,
  prompt_type,
  is_enabled,
  next_run_at,
  last_run_at,
  created_at,
  updated_at
) on table public.processing_flows to authenticated;

grant insert (
  user_id,
  name,
  frequency,
  ai_model,
  prompt_type,
  is_enabled,
  next_run_at,
  last_run_at
) on table public.processing_flows to authenticated;

grant update (
  name,
  frequency,
  ai_model,
  prompt_type,
  is_enabled
) on table public.processing_flows to authenticated;

grant delete on table public.processing_flows to authenticated;

-- This greenfield repository has no production data. Remove any pre-R-11C
-- plaintext custom prompt values that may exist in local/dev databases rather
-- than leaving plaintext at rest without access to the runtime encryption key
-- inside SQL migration execution.
update public.processing_flows
set prompt_template = null
where prompt_type = 'custom'
  and prompt_template is not null
  and prompt_template not like '{"version":"v1","iv":%';
