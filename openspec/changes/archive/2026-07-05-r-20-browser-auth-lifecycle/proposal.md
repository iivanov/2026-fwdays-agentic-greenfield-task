## Why

R-05 established Supabase Auth and R-18 polished the authenticated dashboard, but the browser still treats authentication as a simple session boolean. R-20 completes the user-facing auth lifecycle required by `BR-USER-01`, `A-01`, `T-02`, `T-06`, `NFR-SEC-01`, and `NFR-UX-01`: OAuth callbacks must restore sessions reliably, protected dashboard routes must behave predictably, logout must clear access, and production UI must not expose password auth.

## What Changes

- Add browser OAuth callback handling for `/auth/callback`, including success/session-restoration state, provider error display, and URL cleanup after the Supabase PKCE session is available.
- Add protected dashboard routing for `/dashboard` and dashboard subsection paths while preserving the existing static Vite/Vercel SPA model.
- Redirect OAuth sign-in attempts to `/auth/callback` and return authenticated users to their requested dashboard path when safe.
- Make logout clear local UI state and move the user back to the unauthenticated sign-in screen.
- Hide email/password sign-in controls outside local development or an explicit test/dev flag, satisfying the production-only OAuth posture.
- Add focused unit and Playwright coverage for routing helpers, unauthenticated protected-route behavior, callback error handling, authenticated deep links, logout, and mobile-safe auth/dashboard flows.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `supabase-auth`: Extend the existing auth capability from provider/database configuration to the browser lifecycle around OAuth callbacks, session restoration, protected dashboard routing, logout, and production password-auth posture.

## Impact

- Browser application shell: `packages/browser/src/App.tsx`, shared auth routing helpers, and CSS for auth/callback states.
- Browser tests: focused Vitest for auth routing/session helpers plus Playwright e2e coverage for protected routes, callback errors, fixture-authenticated deep links, logout, and responsive behavior.
- OpenSpec/project records: R-20 change artifacts, roadmap/state/process updates, checker reports, and archive after independent verification/review.
- No new runtime dependency, provider, database schema, secret, hosted account, or paid feature is introduced.
