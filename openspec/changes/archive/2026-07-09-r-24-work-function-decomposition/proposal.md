## Why

The `work` Edge Function has grown into a 2,700+ line module that mixes queue orchestration, ingestion, AI processing, delivery, logging, alerting, and shared database helpers. This makes future changes to `A-04`, `T-05`, `T-11`, and `T-12` behavior harder to review safely, even when the intended change is local.

## What Changes

- Split the `work` Edge Function implementation into focused internal TypeScript modules while preserving its public entrypoint and tested exports.
- Keep queue claiming, acknowledgement, retry, DLQ, ingestion, processing, delivery, alerting, logging, and error responses behaviorally unchanged.
- Add focused OpenSpec and documentation evidence that this is a maintainability refactor, not a product behavior change.
- Non-goals: API router decomposition, database schema changes, migrations, delivery provider changes, schedule changes, and secret/config changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `scheduler-queue`: Clarify that worker implementation decomposition must preserve the existing asynchronous worker contract and observable queue behavior.

## Impact

- Affected code: `supabase/functions/work/` internals and tests that import stable worker exports.
- No external API, database, queue payload, cron, Supabase config, dependency, or secret handling changes.
- Verification uses existing worker Vitest coverage plus Deno check/lint/format/lock and OpenSpec validation.
