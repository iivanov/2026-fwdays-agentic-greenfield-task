# Independent Review — R-11F (2026-07-04)

Verdict: REQUEST CHANGES.

## Blocking Findings

1. `supabase/migrations/20260703000000_scheduler_queue.sql:146` — `claim_job(queue_name text, lease_seconds integer)` still accepts an arbitrary queue name and calls `pgmq.read(queue_name, ...)` without using the R-11F queue-name validator. The same migration grants the RPC to `service_role`/`postgres` at `supabase/migrations/20260703000000_scheduler_queue.sql:280`, so the exposed internal worker RPC can read any pgmq queue the role can access. This violates the R-11F design safety contract that service-role functions validate queue names (`openspec/changes/r-11f-repair-queue-ack/design.md:7`) and leaves the queue claim boundary less constrained than the new completion/archive helpers. Fix direction: call `public.validate_worker_queue_name(queue_name)` at the start of `claim_job` and add a regression assertion for unsupported queue names. Also review the legacy `delete_job`, `archive_job`, and `send_to_queue` helper RPCs for the same allowlist/least-privilege treatment or revoke them if they are no longer part of the supported worker contract.

## Non-Blocking Findings

- None.

## Evidence Checked

- Inspected R-11F proposal, design, delta spec, tasks, verifier report, canonical `scheduler-queue` spec, worker handler, migration SQL, and regression tests.
- Confirmed `complete_worker_job` validates queue name/job type, updates exactly one domain row, and raises if `pgmq.delete(...)` is not true.
- Confirmed `archive_exhausted_worker_job` validates queue name, calls `pgmq.archive(...)` before logging the critical DLQ event, and raises if archive fails.
- Confirmed the worker fails closed on `claim_job` RPC errors, routes success through `complete_worker_job`, uses delivery states `sending`/`delivered`/`failed` with `error_message`, and checks exhausted reads before ordinary execution.
- Confirmed the canonical `openspec/specs/scheduler-queue/spec.md` contains the same three R-11F requirements as the delta.

## Checks Run

- `npx -y @fission-ai/openspec@1.5.0 validate r-11f-repair-queue-ack --strict` passed.
- `git diff --check` passed.
- `npm run test -- packages/browser/src/lib/queue-worker.test.ts` passed: 1 file, 4 tests.
- I relied on the verifier report for the broader static/unit/build gate list. I did not treat `npm run supabase:lint` or `npm run test:integration` as passed because the verifier recorded local Supabase/Postgres as unavailable.
