## 1. Specification and Data Layer

- [x] 1.1 Create the R-17 OpenSpec proposal, design, tasks, and delta spec
  tracing to `A-07`, `AT-10`, `AT-12`, `D-06`, and `NFR-OPS-*`.
- [x] 1.2 Add a forward SQL migration for service-role-only alert claim helpers
  and any required operational-event support indexes/grants.

## 2. Runtime Implementation

- [x] 2.1 Add structured, sanitized logging helpers to scheduler, cleanup, and
  worker paths.
- [x] 2.2 Add operational-event alerting helpers that atomically claim critical
  alert sends and send compact Brevo operator emails without blocking domain
  state transitions on alert delivery failure.
- [x] 2.3 Add configurable AI daily and per-response token budget guardrails that
  fail closed and record sanitized `provider_quota` events.

## 3. Tests and Documentation

- [x] 3.1 Add focused unit/integration tests for structured log redaction,
  alert deduplication, and AI budget failure paths.
- [x] 3.2 Update `docs/state.md`, `docs/roadmap.md`, and
  `docs/development_process.md` with R-17 progress and evidence.

## 4. Verification

- [x] 4.1 Run focused R-17 tests plus relevant local gates, including
  OpenSpec strict validation, Deno gates, Supabase migration lint/integration
  where applicable, and `git diff --check`.
- [x] 4.2 Run independent verifier and reviewer sub-agents on the final diff,
  fix blocking findings, rerun both checker passes, then archive and commit.
