## 1. Planning and Traceability

- [ ] 1.1 Update the technology and hosting decision docs from Vercel static hosting to GitHub Pages static hosting with 2026-07-08 source verification.
- [ ] 1.2 Update deployment setup/process/state docs to record the new GitHub Pages bootstrap and OAuth callback implications.

## 2. Landing Page Implementation

- [ ] 2.1 Add the generated newsroom hero asset to the browser package and reference it from the unauthenticated shell.
- [ ] 2.2 Replace the unauthenticated sign-in screen with a responsive landing page that preserves OAuth sign-in, callback error display, protected-route return storage, and production-hidden password auth.
- [ ] 2.3 Update browser HTML/CSS typography, layout, responsive behavior, focus states, and overflow constraints for the landing page.

## 3. GitHub Pages Deployment

- [ ] 3.1 Configure Vite to use a GitHub Pages-compatible production base path with an environment override and local `/` default.
- [ ] 3.2 Add a build step that emits `404.html` from the generated `index.html` for Pages direct-link fallback.
- [ ] 3.3 Add a pinned GitHub Pages workflow that builds the browser workspace, uploads `packages/browser/dist`, and deploys through the `github-pages` environment.
- [ ] 3.4 Update the deployment audit to validate GitHub Pages workflow/static-only configuration and no-secrets bootstrap boundaries.

## 4. Tests and Verification

- [ ] 4.1 Update focused unit and Playwright tests for the landing page, callback errors, dashboard deep links, responsive mobile behavior, and Pages base-path helpers.
- [ ] 4.2 Run applicable maker gates: focused tests, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run infra:audit`, `npm run build:browser`, `npm run test:e2e`, OpenSpec strict validation, and `git diff --check`.
- [ ] 4.3 Capture verification evidence in `openspec/changes/r-21-public-landing-github-pages/verification.md`.
- [ ] 4.4 Obtain independent verifier and reviewer passes by separate checker sub-agents on the final diff.

## 5. Closure

- [ ] 5.1 Mark completed tasks, update `docs/development_process.md`, and refresh `docs/state.md`.
- [ ] 5.2 Commit the planning stage and implementation stage on `main` without secrets, provider state, or generated private config.
