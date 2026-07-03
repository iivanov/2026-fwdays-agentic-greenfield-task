## Context

Background job queues and periodic scheduling are critical to decouple active HTTP API operations from long-running ingestion, AI processing, and delivery pipelines. Currently, the database contains tables for tracking runs (`source_fetch_runs`, `processing_runs`), digests, and attempts, but lacks active queue messaging pipelines, dead-letter routes, and cron scheduling triggers.

## Goals / Non-Goals

**Goals:**
- Enable `pgmq` and `pg_cron` database extensions.
- Provision queues: `ingestion-queue`, `processing-queue`, and `delivery-queue`.
- Set up cron jobs calling edge functions: `schedule-daily` at 06:00 UTC, `work` every minute (stub worker/drain), and `cleanup` every 30 minutes.
- Build Deno edge functions for `schedule-daily`, `work`, and `cleanup` validating `service_role` JWT invocation.
- Define visibility lease timeout recovery (5 minutes) and dead-letter queue (DLQ) transitions after 5 consecutive failures.
- Implement structured cleanup: purge run history, cached contents, digests, and delivery records older than 7 days.

**Non-Goals:**
- Implementing the actual HTML scraping/feed parsing logic (R-12), actual OpenAI generation calls (R-13), or actual Slack/Telegram integrations (R-14) in this change. Stubs will represent successful work execution in this slice.

## Decisions

1. **Database-Native Queues (`pgmq`) over BullMQ/Redis**:
   - *Rationale*: Fits the $0 free-tier budget, eliminates external dependencies/hosting, and supports transaction integrity.
   - *Alternatives*: Redis/BullMQ (rejected due to added hosting complexity and fee thresholds).
2. **Cron Scheduler (`pg_cron` + `pg_net`) over External HTTP Schedulers**:
   - *Rationale*: Integrates natively in Supabase Free tier and executes background tasks asynchronously.
3. **Lease Visibility Timeout of 5 minutes**:
   - *Rationale*: Allows worker execution of long tasks (AI extraction, ingestion timeout limits) while ensuring fast recovery on crash.
4. **Data Purging Strategy (7 Days Retention)**:
   - *Rationale*: Prevents database bloat on free tier, satisfying NFR-DATA-02 constraints.

## Risks / Trade-offs

- **[Risk]**: Local pg_cron / pg_net setup requires correct configuration of network routes to hit local edge functions.
  - *Mitigation*: Integration tests will mock HTTP calls and execute Deno logic directly via mock payloads, ensuring validation of worker Deno code.
- **[Risk]**: pg_cron / pg_net is disabled or not running on local docker start.
  - *Mitigation*: The worker edge function `work` can also be triggered programmatically or manually run via tests to verify functionality.
