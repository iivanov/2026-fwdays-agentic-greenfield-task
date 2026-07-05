## Why

R-16 closed retention and cleanup evidence, leaving Phase 4 observability and
free-tier guardrails as the next operational slice. The current workers already
record some operational events, usage metadata, and circuit state, but R-17
needs a consistent operator-facing path: correlated structured logs,
sanitized/deduplicated critical alerts, and explicit fail-closed AI budget
controls.

## What Changes

- Add structured, content-free logs for scheduler, cleanup, and worker
  invocations with correlation/request/job identifiers, durations, outcomes,
  retry counts, and provider request IDs where applicable.
- Add database-backed alert-claim helpers for `OperationalEvent` rows so
  critical events can trigger one Brevo operator email per deduplication key
  per cooldown window without duplicate reminders.
- Route critical worker events through the alert path while keeping event
  context sanitized and ID-only.
- Add AI usage budget checks before provider calls and after responses. When a
  configured budget is exhausted or a response crosses the budget, fail closed,
  persist a `provider_quota` operational event, record failed response usage
  where applicable, and acknowledge budget-exhausted processing work terminally
  so the same job does not retry into repeated provider spend.
- Add unit/integration coverage for correlation logs, alert deduplication, and
  AI budget failure paths.

## Scope

In scope:

- Edge Function code and SQL migrations needed by the existing Supabase stack.
- Tests for the worker/runtime behavior.
- State/process documentation for R-17 progress and evidence.

Out of scope:

- New external observability SaaS, dashboards, metrics pipelines, or paid
  provider features.
- Changing upstream product behavior, delivery channel setup, or R-18 dashboard
  polish.
- Hosted provider account configuration; secrets remain human-bootstrap items.

## Upstream Traceability

- `A-07` observable operations.
- `AT-10` correlated observability.
- `AT-12` cost guardrails.
- `D-03` deterministic flow run usage metadata.
- `D-06` operational events, circuit state, provider request/usage metadata.
- `NFR-OPS-01..03`, `NFR-CON-03..06`, `NFR-PERF-04`.
- `T-10`, `T-11`, `T-12`.
