## Context

`supabase/functions/work/index.ts` currently contains queue orchestration, feed ingestion, AI digest processing, delivery adapters, operational alerting, structured logging, error normalization, and shared database helpers in one 2,700+ line file. The existing worker behavior is well covered by focused Vitest suites and Deno gates, so the safest implementation is a mechanical module split with stable exports rather than a semantic rewrite.

## Goals / Non-Goals

**Goals:**

- Keep `work/index.ts` as the Supabase Edge Function entrypoint and compatibility export surface.
- Move cohesive worker domains into internal modules: types, errors, db helpers, logging, alerting, ingestion, processing, delivery, and queue handler.
- Preserve queue contract, database RPC names/payloads, response statuses, logging redaction, SSRF protection, encrypted config usage, webhook signing, and provider budget handling.
- Update development records and verification evidence.

**Non-Goals:**

- No API router decomposition in `supabase/functions/api/helpers.ts`.
- No database migrations, RLS/policy changes, queue payload changes, cron changes, dependency changes, or secret handling changes.
- No behavior changes to ingestion, AI processing, delivery retries, DLQ, cleanup, or scheduler behavior.

## Decisions

- Keep `index.ts` as a thin barrel plus Edge Function default export. This preserves tests and callers that import from `work/index.ts` while allowing internals to move.
- Split by runtime responsibility instead of by test file. Ingestion, processing, and delivery each become independent domains; shared concerns move to `types.ts`, `errors.ts`, `db.ts`, `logging.ts`, and `alerting.ts`.
- Use Deno-compatible relative imports with explicit `.ts` extensions. This matches the existing Edge Function style and avoids bundler-only behavior.
- Preserve currently exported helper names from `work/index.ts`. Tests can migrate later if desired, but this slice must remain backward-compatible.

## Risks / Trade-offs

- Import cycles could appear during the split -> keep shared types and helpers in low-level modules and make domain modules depend inward only.
- Type visibility could drift from runtime behavior -> run focused worker Vitest suites plus Deno check/lint/format/lock.
- A mechanical split can hide accidental behavior edits -> compare exported symbols and rely on existing ingestion, processing, delivery, and queue tests before committing.
- More files add navigation overhead -> module names match worker responsibilities so future edits can be localized.
