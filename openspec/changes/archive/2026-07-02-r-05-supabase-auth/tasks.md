## 1. Config & Providers

- [x] 1.1 Add `[auth.external.google]` section to `supabase/config.toml` with `enabled = true` and env-var secrets.
- [x] 1.2 Add `[auth.external.github]` section to `supabase/config.toml` with `enabled = true` and env-var secrets.

## 2. Database Migration

- [x] 2.1 Create migration `supabase/migrations/20260702000200_auth_trigger.sql` with `handle_new_user()` function and trigger on `auth.users`.
- [x] 2.2 Verify migration applies with `supabase db reset`.

## 3. Browser Client

- [x] 3.1 Install `@supabase/supabase-js` in `packages/browser`.
- [x] 3.2 Create `packages/browser/src/lib/supabase.ts` with typed Supabase client using PKCE flow.
- [x] 3.3 Re-export from `packages/browser/src/index.ts`.

## 4. Environment & Docs

- [x] 4.1 Update `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and OAuth provider env vars.
- [x] 4.2 Update `docs/development_process.md` with R-05 milestone.

## 5. Verification & Archive

- [x] 5.1 Run all gates (typecheck, lint, format, test, supabase:reset, supabase:lint).
- [x] 5.2 Spawn verifier sub-agent.
- [x] 5.3 Spawn reviewer sub-agent.
- [x] 5.4 Archive on pass.
