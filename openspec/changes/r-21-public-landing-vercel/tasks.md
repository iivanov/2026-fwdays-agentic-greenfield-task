## 1. Planning and Traceability

- [x] 1.1 Confirm the technology and hosting decision docs still select Vercel static hosting and record the user clarification.
- [x] 1.2 Update deployment setup/process/state docs to record the new public landing page on the Vercel-hosted browser app.

## 2. Landing Page Implementation

- [x] 2.1 Add the generated newsroom hero asset to the browser package and reference it from the unauthenticated shell.
- [x] 2.2 Replace the unauthenticated sign-in screen with a responsive landing page that preserves OAuth sign-in, callback error display, protected-route return storage, and production-hidden password auth.
- [x] 2.3 Update browser HTML/CSS typography, layout, responsive behavior, focus states, and overflow constraints for the landing page.

## 3. Vercel Static Deployment

- [x] 3.1 Keep `vercel.json` as the static frontend deployment config with SPA fallback and no Vercel Functions/Cron/API proxy behavior.
- [x] 3.2 Update Vercel CSP/header configuration to allow the committed landing page assets, Google font endpoints, and Supabase browser/API connections.
- [x] 3.3 Update the deployment audit to validate Vercel static-only configuration, landing-page CSP needs, and no-secrets bootstrap boundaries.

## 4. Tests and Verification

- [x] 4.1 Update focused unit and Playwright tests for the landing page, callback errors, dashboard deep links, and responsive mobile behavior.
- [x] 4.2 Run applicable maker gates: focused tests, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run infra:audit`, `npm run build:browser`, browser smoke E2E, OpenSpec strict validation, and `git diff --check`.
- [x] 4.3 Capture verification evidence in `openspec/changes/r-21-public-landing-vercel/verification.md`.
- [ ] 4.4 Obtain independent verifier and reviewer passes by separate checker sub-agents on the final diff.

## 5. Closure

- [x] 5.1 Mark completed tasks, update `docs/development_process.md`, and refresh `docs/state.md`.
- [x] 5.2 Commit the planning stage and implementation stage on `main` without secrets, provider state, or generated private config.
