## Context

`supabase-auth` already requires Google/GitHub OAuth with PKCE, local-only password authentication, and profile/channel provisioning. The browser client is configured with `flowType: 'pkce'`, `persistSession: true`, and `detectSessionInUrl: true`, which matches current Supabase JavaScript auth documentation checked on 2026-07-05. Supabase `signInWithOAuth` supports PKCE and a `redirectTo` option, while `onAuthStateChange` emits initial, signed-in, signed-out, and token-refresh events.

The missing piece is the browser lifecycle around those primitives. R-20 keeps the deployment static-only and implements path-aware UI state inside the SPA rather than adding server routes or a new auth service.

## Decisions

1. **Use route helper functions, not a new router migration.**
   The technology decision names React Router for the long-term browser approach, but the existing app currently has no router dependency. R-20 will implement a small typed route helper module over `window.location`/History to keep the slice scoped and avoid a broad app rewrite. A future router migration can reuse the same path contract.

2. **Canonical browser paths.**
   - `/` is the unauthenticated sign-in shell.
   - `/auth/callback` is the OAuth return path.
   - `/dashboard` opens the authenticated overview.
   - `/dashboard/{overview|profile|sources|flows|delivery|digests}` opens a specific dashboard tab.
   Unknown dashboard tabs normalize to overview.

3. **Safe return path only.**
   The app stores only same-origin dashboard paths as the post-auth return target in `sessionStorage`. External URLs, protocol-relative URLs, auth callback paths, and non-dashboard paths are ignored and normalize to `/dashboard`.

4. **Session restoration state.**
   On initial load, the app renders a neutral loading/callback state while Supabase restores or exchanges the PKCE session. If `/auth/callback` contains provider error parameters, the app shows that error on the sign-in shell and replaces the URL with `/`.

5. **Logout state.**
   Logout calls `supabase.auth.signOut()`, clears UI error/return state, resets the active tab to overview, and replaces the browser path with `/`. The `SIGNED_OUT` event keeps local state consistent if sign-out is triggered elsewhere.

6. **Local password auth stays local.**
   Email/password controls render only when `import.meta.env.DEV` is true or `VITE_ENABLE_DEV_PASSWORD_AUTH=1` is supplied. Production and e2e builds without that explicit flag show only Google/GitHub OAuth.

## Security

- This change does not add secrets, service-role usage, or provider configuration. Browser code continues to use only the public Supabase URL/key.
- Redirect targets are same-origin dashboard paths only, preventing open redirects through `redirect`/return-path state.
- Password auth controls are hidden in production builds by default, matching `BR-USER-01` and `NFR-SEC-01`; hosted production must still disable password auth in Supabase Auth settings as already documented.
- Authenticated API calls remain JWT-backed through existing panel code and RLS/database policies.

## Reliability and UX

- Deep links to dashboard subsections are deterministic before and after session restoration.
- Callback and protected-route states are explicit, readable, and responsive.
- E2E fixture mode remains available only in `MODE=e2e` with `VITE_E2E_DASHBOARD_FIXTURE=1` and a `fixture=dashboard` query parameter, so production builds cannot activate fixture sessions accidentally.

## Non-Goals

- No database migrations or Supabase Auth provider console changes.
- No production deployment, provider account creation, OAuth app registration, or secret entry.
- No full React Router refactor.
- No new password-auth capability beyond the existing local-dev/test posture.
