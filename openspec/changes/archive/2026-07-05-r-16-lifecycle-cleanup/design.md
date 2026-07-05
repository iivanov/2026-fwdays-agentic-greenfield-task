## Context

R-11F repaired transactional queue acknowledgement and dead-letter archiving.
R-11G replaced `cleanup_runs()` with distinct seven-day content and 30-day
metadata lifecycles. R-13/R-14 added processing and delivery-specific cleanup
paths. R-16 closes the Phase 4 lifecycle item by making the maintenance contract
explicit and filling any evidence gaps instead of reworking already-correct
runtime behavior.

## Goals / Non-Goals

**Goals:**

- Ensure cleanup runs on the documented 30-minute cadence, satisfying the
  seven-day purge with at most one hour of cleanup lag.
- Ensure content-bearing articles, digests, and delivery attempts are deleted
  after seven days while sanitized metadata follows its longer lifecycle.
- Ensure abandoned source, processing, and delivery leases are recoverable.
- Ensure exhausted queue work is surfaced through sanitized operational events.
- Document that no separate durable news cache exists beyond the domain records
  governed by content lifecycle rules.

**Non-Goals:**

- No new storage/cache provider.
- No change to business retention requirements.
- No replay UI or operator alerting workflow; those remain R-17 observability.

## Decisions

- **Treat R-16 as lifecycle closure, not a rewrite.** Existing migrations already
  implement most requirements. The change should add missing evidence and
  canonical specs rather than duplicate SQL.
- **Keep cleanup database-owned.** The Edge Function remains a thin
  service-key-protected wrapper around `cleanup_runs()` so cleanup is testable
  in local Supabase and deployable through migrations.
- **Use no separate durable cache.** The selected stack uses source/article
  records as the shared cache of record and per-invocation memory only as an
  optimization. Therefore R-16 verifies no additional durable news cache extends
  content retention.

## Risks / Trade-offs

- **R-16 overlaps earlier remediation work** -> Mitigated by explicitly
  documenting which behavior is reused and adding only evidence gaps.
- **Queue archive retention is owned by pgmq internals** -> Mitigated by
  ensuring archived messages contain ID-only/sanitized payloads and DLQ events
  surface exhaustion; deeper archive pruning can be revisited if queue storage
  pressure appears.
- **No separate cache means 24-hour cache expiry is mostly architectural** ->
  Mitigated by verifying no durable cache table/provider exists and content
  records are governed by the stricter seven-day product retention rule.
