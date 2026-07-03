## 1. Database Migrations

- [ ] 1.1 Create migration file `supabase/migrations/20260703000000_scheduler_queue.sql` to load `pgmq` and `pg_cron` extensions.
- [ ] 1.2 Initialize queues `ingestion-queue`, `processing-queue`, `delivery-queue` using pgmq.
- [ ] 1.3 Register pg_cron jobs `schedule-daily-job`, `worker-drain-job`, and `cleanup-job` in the migration.

## 2. Supabase Edge Functions

- [ ] 2.1 Implement `schedule-daily` Edge Function logic scanning active due flows, creating run cycles, and queueing ingestion jobs.
- [ ] 2.2 Implement `work` Edge Function worker logic polling queue messages, updating runs state, managing lease timeout visibility, recording operational events, and moving to DLQ on failure limit (5).
- [ ] 2.3 Implement `cleanup` Edge Function logic reclaiming expired leases and purging records older than 7 days.
- [ ] 2.4 Add routing support for scheduling/queue jobs inside the main edge functions router.

## 3. Unit and Integration Tests

- [ ] 3.1 Write unit tests in `packages/browser/src/lib/queue-runner.test.ts` verifying scheduling logic, message leases, retries, and cleanup limits.

## 4. Verification and Handoff

- [ ] 4.1 Run linter, formatter, typecheck compilation, and tests verifying all gates pass successfully.
- [ ] 4.2 Spawn independent verifier and reviewer subagents to confirm the changes are 100% correct.
