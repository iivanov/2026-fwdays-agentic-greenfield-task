# R-05: Supabase Auth — Google/GitHub OAuth (PKCE)

## Summary

Enable Supabase Auth with Google and GitHub OAuth providers using the PKCE
flow. Auto-create a user profile and default delivery channels on first
sign-in via a database trigger. Provide a minimal Supabase client in the
browser package for downstream slices to consume.

## Upstream IDs

BR-USER-01, T-06, NFR-SEC-01, A-06, AT-07

## Scope

- Enable Google + GitHub OAuth in `supabase/config.toml` (local dev).
- Create `handle_new_user()` trigger on `auth.users` (auto-profile + default
  in-app and email delivery channels).
- Create a typed Supabase client module in `packages/browser/`.
- Update `.env.example` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Document that production disables email/password auth via the hosted
  Supabase dashboard (not in config.toml, which is local-dev only).

## Non-Goals

- React UI components for login/logout (R-07+).
- `api` Edge Function skeleton (R-06).
- Profile management CRUD (R-07).
- Delivery channel management UI (R-10).
