# Independent Review

Reviewer: Euclid (sub-agent)
Date: 2026-07-04
Change: `r-12-ingestion-worker`
Verdict: APPROVE

## Blocking Findings

None.

## Non-Blocking Findings

1. `docs/development_process.md` recorded the full unit suite as 104 tests
   before the final reviewer-fix regressions. Disposition: fixed before archive;
   the process log now records 109 tests.
2. `supabase/functions/work/index.ts` inserts the article and fingerprint in
   separate operations. Residual risk: a concurrent worker race can still
   surface a uniqueness failure after pre-insert dedupe and count as a source
   failure. The current implementation satisfies the requested pre-insert
   URL/fingerprint checks, but it is not a fully transactional dedupe claim.

## Evidence Inspected

- `supabase/functions/work/index.ts`
- `packages/browser/src/lib/ingestion-worker.test.ts`
- `supabase/functions/api/ssrf.ts`
- `openspec/changes/r-12-ingestion-worker/*`
- `package.json`, Deno config, and Deno lock references
- `docs/state.md` and `docs/development_process.md`
- schema/RPC migrations for article/fingerprint uniqueness, operational events,
  and queue acknowledgement/failure behavior

The reviewer confirmed prior blockers were fixed:

- Streaming body-size limit counts chunks and cancels on overflow.
- Timeout includes stalled body reads through the shared abort signal.
- Unsafe ingestion failures map to safe categories, and invalid publication
  dates normalize to `null` before database writes.
- SSRF redirect handling uses manual redirects and revalidates redirect targets.
- Ingestion queue completion happens after `ingestSource()` succeeds.

## Evidence Relied On

The reviewer relied on supplied final gate evidence for focused ingestion tests,
full unit suite, typecheck, lint, format, Deno check/lint/fmt/lock, Supabase
integration tests, npm audit, OpenSpec validation, and `git diff --check`.
