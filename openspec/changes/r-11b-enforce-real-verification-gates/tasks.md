## 1. OpenSpec planning

- [x] 1.1 Create proposal, design, delta spec, and implementation tasks for R-11B.
- [x] 1.2 Validate the R-11B OpenSpec change strictly before implementation.

## 2. Deno Edge Function gates

- [x] 2.1 Add committed Deno configuration/lock support covering `supabase/functions/**`.
- [x] 2.2 Add root scripts for Deno check, lint, format check, lock validation, and dependency audit.
- [ ] 2.3 Ensure Deno gates do not rely on paused R-12 draft files.

## 3. Node, coverage, and integration gates

- [x] 3.1 Add backend/API helper coverage configuration and a root coverage script with enforced thresholds.
- [x] 3.2 Split Supabase integration tests from default unit tests.
- [x] 3.3 Replace silent Supabase integration skips with explicit prerequisite failure output.

## 4. Browser behavioral gate

- [x] 4.1 Add Playwright configuration, browser smoke test, and root `test:e2e` script.
- [x] 4.2 Add a browser build gate used by CI and verifier evidence.

## 5. CI and documentation

- [x] 5.1 Update GitHub Actions to run the new local-equivalent gates with pinned setup actions.
- [ ] 5.2 Update AGENTS.md, development process, roadmap status, and state records after gates are proven runnable.

## 6. Independent checks

- [ ] 6.1 Run applicable local gates and retain `verification.md` with exact evidence.
- [ ] 6.2 Run independent review and retain `review.md` with final disposition.
- [ ] 6.3 Sync/archive the OpenSpec change and commit the completed stage.
