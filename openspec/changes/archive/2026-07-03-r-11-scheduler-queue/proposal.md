## Why

Establish the background coordination, queue processing, daily scheduler execution, and cleanup jobs needed for asynchronous processing. This enables decoupled source ingestion, structured AI summarization, and external delivery attempts.

## What Changes

- Create a new migration file `supabase/migrations/20260703000000_scheduler_queue.sql` to enable `pgmq` and `pg_cron` extensions, define message queues (`ingestion-queue`, `processing-queue`, `delivery-queue`), and register pg_cron job schedules.
- Create Deno edge functions under `supabase/functions/`:
  - `schedule-daily`: scans for active, due user processing flows, inserts pending cycle run records (`source_fetch_runs`, `processing_runs`), and enqueues corresponding ingestion jobs.
  - `work`: consumes a claimed queue job, leases it, executes the job runner skeleton, handles transient/non-transient errors, logs failures to `operational_events`, and moves exhausted messages (5 failures) to a dead-letter queue (DLQ) or table.
  - `cleanup`: runs every 30 minutes to recover expired visibility leases (older than 5 minutes), prune run histories, and permanently delete digests, articles, and logs older than 7 days.
- Write unit/integration tests for queue operations, worker claims, lease recoveries, and cleanup loops.

## Capabilities

### New Capabilities
- `scheduler-queue`: Background scheduler and queue processing loops.

### Modified Capabilities
<!-- No requirement changes to existing capabilities -->

## Impact

- **Database**: Migration enabling `pgmq`/`pg_cron` and setting up cron schedules.
- **API Functions**: Edge functions `schedule-daily`, `work`, and `cleanup` deployed to Supabase.
- **Tests**: Vitest suites covering scheduler and queue worker flows.
