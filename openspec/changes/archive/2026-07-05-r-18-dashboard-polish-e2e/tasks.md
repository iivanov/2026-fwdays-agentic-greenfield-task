## 1. Specification and Design

- [x] 1.1 Create the R-18 OpenSpec proposal, design, tasks, and delta specs
  tracing to `NFR-UX-01`, `NFR-PERF-02`, `A-01`, `A-04`, `Q-04`, `T-02`, and
  `T-12`.
- [x] 1.2 Update `docs/state.md`, `docs/roadmap.md`, and
  `docs/development_process.md` with R-17 CI closure and R-18 progress.

## 2. Runtime UI Implementation

- [x] 2.1 Replace the dark/glass authenticated dashboard styling with the
  approved light newsroom design tokens and responsive layout rules.
- [x] 2.2 Add an authenticated dashboard overview showing digest history, flow
  run/status summaries, and source health warnings from deterministic durable
  state reads.
- [x] 2.3 Keep existing profile, sources, flows, delivery, and digests panels
  reachable and responsive without adding inline ingestion/processing/delivery
  execution commands.
- [x] 2.4 Improve digest feedback controls and status treatments so they remain
  clear and reachable on desktop and mobile.

## 3. Tests and Verification Artifacts

- [x] 3.1 Add focused unit tests for any extracted dashboard data derivation or
  responsive-status helpers.
- [x] 3.2 Extend Playwright e2e coverage with deterministic authenticated
  dashboard scenarios at desktop and mobile viewports.
- [x] 3.3 Capture behavioral verification evidence for R-18 in the change
  directory.

## 4. Verification

- [x] 4.1 Run focused R-18 tests plus relevant local gates, including
  `npm run typecheck`, `npm run lint`, `npm run format`, `npm run test`,
  `npm run build:browser`, `npm run test:e2e`, OpenSpec strict validation, and
  `git diff --check`.
- [x] 4.2 Run independent verifier and reviewer sub-agents on the final diff,
  fix blocking findings, rerun both checker passes, then archive and commit.
