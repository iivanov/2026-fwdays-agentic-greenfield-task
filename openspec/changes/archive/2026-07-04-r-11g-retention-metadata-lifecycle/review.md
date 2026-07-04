# Review: r-11g-retention-metadata-lifecycle

## Verdict

APPROVE.

## Blocking findings

None.

## Non-blocking findings

None.

## Evidence inspected

- Reviewed the R-11G proposal, design, tasks, and scheduler-queue delta against
  BR-DATA-01/02, D-05/D-06, AT-08, NFR-DATA-01..03, and NFR-OPS-02.
- Inspected `cleanup_runs()` in
  `supabase/migrations/20260704104026_r11g_retention_metadata_lifecycle.sql`.
  The function deletes `digest_delivery_attempts`, `processed_digests`, and
  `ingested_articles` at seven days; retains `source_fetch_runs` and
  `processing_runs` until 30 days; deletes only resolved `operational_events`
  by `resolved_at`; deletes only stale closed `integration_circuits`; returns
  count-only metadata; and revokes public RPC execution while granting only
  `service_role` and `postgres`.
- Checked cascade behavior against the base schema: delivery attempts cascade
  from `processed_digests`, flow articles cascade from article/run deletion, and
  service-role cleanup does not relax RLS policies.
- Inspected
  `packages/browser/src/lib/cleanup-retention.integration.test.ts`. The focused
  regression seeds expired content, 20-day run metadata, unresolved and resolved
  operational events, and open/closed circuits, then invokes the cleanup Edge
  handler and verifies deletion/retention outcomes.
- Reviewed `vitest.integration.config.ts`. Disabling integration
  `fileParallelism` is scoped to the Supabase integration Vitest config, and the
  repo already has integration files that mutate the same local database,
  queues, auth users, and shared tables.

## Checks run

- `npx -y @fission-ai/openspec@1.5.0 show r-11g-retention-metadata-lifecycle`
  passed.
- `npx -y @fission-ai/openspec@1.5.0 validate r-11g-retention-metadata-lifecycle --strict`
  passed.
- `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` passed.
- `git diff --check` passed.
- `npm run test:integration -- packages/browser/src/lib/cleanup-retention.integration.test.ts`
  passed.
- `npm run supabase:lint` passed.

I did not rely on maker self-review as approval evidence; this report is based
on direct inspection and the checks above.
