## 1. OpenSpec planning

- [x] 1.1 Create R-20 proposal, design, spec delta, and implementation tasks.
- [x] 1.2 Validate the R-20 OpenSpec change in strict mode before implementation.

## 2. Browser auth lifecycle implementation

- [x] 2.1 Add typed browser auth-route/session helper functions for callback detection, safe return paths, dashboard tab path mapping, and dev-password-auth gating.
- [x] 2.2 Wire the app shell to restore Supabase sessions, process `/auth/callback` success/error states, normalize protected dashboard routes, and keep dashboard tab state synchronized with the browser path.
- [x] 2.3 Update OAuth initiation to redirect to `/auth/callback` and preserve only safe same-origin dashboard return paths.
- [x] 2.4 Update logout to invoke Supabase sign-out, clear local route/session UI state, and return to `/`.
- [x] 2.5 Hide email/password controls outside local development or an explicit dev-password-auth flag.

## 3. Tests and behavioral evidence

- [x] 3.1 Add focused Vitest coverage for auth route helpers and dev-password-auth gating.
- [x] 3.2 Update Playwright browser smoke tests for production-hidden password auth, protected dashboard routes, callback errors, authenticated deep links, logout, and mobile overflow.
- [x] 3.3 Run focused browser tests, e2e tests, and the applicable local verification gates.

## 4. Records and checker loop

- [x] 4.1 Update `docs/state.md`, `docs/roadmap.md`, and `docs/development_process.md` with R-20 progress and evidence.
- [x] 4.2 Run independent verifier sub-agent on the final diff and retain `verification.md`.
- [x] 4.3 Run independent reviewer sub-agent on the final diff and retain `review.md`.
- [x] 4.4 Fix any blocking verifier/reviewer findings and rerun both checker passes.
- [x] 4.5 Archive the R-20 OpenSpec change, commit the stage on `main`, push, and watch GitHub CI/CodeQL.
