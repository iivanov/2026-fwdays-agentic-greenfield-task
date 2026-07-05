## Verdict

APPROVE

## Blocking Findings

None.

The prior schema-repair budget blocker is closed in the current diff. Provider
response metadata is extracted and checked before schema parsing
(`supabase/functions/work/index.ts:1846`-`1854`), so an over-budget malformed or
schema-invalid response throws `ai_budget_exhausted` before the repair call.
The failed response usage is recorded before throwing
(`supabase/functions/work/index.ts:2137`-`2172`), and the worker catches that
error with a terminal acknowledgement path instead of `fail_worker_job`
(`supabase/functions/work/index.ts:2680`-`2710`). Under-budget schema-invalid
responses are also recorded as `failed_provider` before the one allowed repair
attempt (`supabase/functions/work/index.ts:2174`-`2186`), and daily accounting
now includes the failed-usage ledger
(`supabase/migrations/20260705102552_r17_observability_guardrails.sql:118`-`135`).

## Non-Blocking Findings

1. `supabase/functions/cleanup/index.ts:60` and
   `supabase/functions/schedule-daily/index.ts:60` - The scheduler and cleanup
   success logs spread whole RPC result objects into structured logs. The
   current RPCs return counters only, so I did not find a content or secret
   leak in this diff. The pattern is still more fragile than the worker
   sanitizer/allowlist because a future RPC result field would be logged
   automatically. Recommended disposition: whitelist the known counter fields
   or share the worker-style safe log helper when these functions are touched
   next.

2. `packages/browser/src/lib/queue-worker.test.ts:532` - SQL privilege coverage
   for the new observability helpers is still text-based. The migration itself
   enables RLS on `ai_usage_events`, revokes anon/authenticated table access,
   and revokes public function execution before granting worker roles, and the
   verifier's local Supabase lint/integration gates passed. Recommended
   disposition: keep the text regression as a cheap guard and add DB-level
   privilege assertions if these helper RPCs or table grants change again.

## Evidence Inspected

- OpenSpec artifacts:
  `openspec/changes/r-17-observability-guardrails/proposal.md`,
  `design.md`, `tasks.md`, and
  `specs/observability-guardrails/spec.md`.
- Runtime code: `supabase/functions/work/index.ts`,
  `supabase/functions/cleanup/index.ts`, and
  `supabase/functions/schedule-daily/index.ts`.
- Migration:
  `supabase/migrations/20260705102552_r17_observability_guardrails.sql`.
- Tests: `packages/browser/src/lib/processing-worker.test.ts` and
  `packages/browser/src/lib/queue-worker.test.ts`.
- Current proposal cleanup: `proposal.md` now describes terminal
  acknowledgement for budget-exhausted processing work, matching the delta
  spec, tests, and runtime path.
- Verifier evidence in
  `openspec/changes/r-17-observability-guardrails/verification.md`: focused
  R-17 tests `31 passed`, full unit suite `152 passed`, Supabase lint and
  integration tests passed, OpenSpec strict validation passed, and
  `npm run verify:local` passed.
