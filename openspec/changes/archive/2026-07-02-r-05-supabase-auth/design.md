# R-05 Design: Supabase Auth

## Decision: Profile auto-creation trigger

The `handle_new_user()` function is `SECURITY DEFINER` with `search_path = ''`
because it fires on `auth.users` (schema the user doesn't own) and must insert
into `public.profiles` and `public.delivery_channels` bypassing RLS.

The function is safe: it only fires as an `AFTER INSERT` trigger on
`auth.users`, which is controlled by Supabase Auth — it cannot be called
directly by an authenticated user.

## Decision: Default delivery channels

Per T-06 §7: "Email and in-app channels are created after first OAuth sign-in."

- **in-app**: Created with `status = 'active'` (no verification needed — the
  user is inherently present in the app).
- **email**: Created with `status = 'active'` and `verified_at = now()` when
  `email_confirmed_at IS NOT NULL` (OAuth providers verify email). Otherwise
  `status = 'pending'`.

The `SECURITY DEFINER` context bypasses the strict delivery channel INSERT
policy that requires `status = 'pending'` for authenticated users. This is
intentional: the system (not the user) creates these channels.

## Decision: Password auth scope

`config.toml` enables email/password for local development convenience.
Production disablement is a Supabase dashboard setting, documented in
`.env.example` and `development_process.md`. The config.toml file is
local-dev only and never deployed.

## Decision: Supabase client module

A minimal `createClient()` wrapper in `packages/browser/src/lib/supabase.ts`
reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Vite env. This
gives downstream slices (R-06, R-07+) a typed, importable client without
duplicating configuration. The PKCE auth flow type is configured explicitly.
