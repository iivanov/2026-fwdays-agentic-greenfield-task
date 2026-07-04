## Verdict: APPROVE

Date: 2026-07-04
Role: final independent reviewer

I reviewed the current working tree for `r-13-ai-processing-worker`, including
the R-13 OpenSpec proposal/design/tasks/spec, verification report, data/process
docs, the Edge worker implementation, the R-13 migration, and focused
processing/queue tests. I did not edit implementation code.

Reviewer evidence run:

- `openspec validate r-13-ai-processing-worker --strict` passed.
- `git diff --check` passed.
- Targeted secret/content inspection produced only expected documentation,
  runtime variable names, and test placeholders; I found no real R-13 secret
  values in the reviewed diff.

I used the reported maker/verifier gates as supporting evidence, but the
approval is based on direct inspection of the current diff and queue contracts.

## Blocking Findings

None.

## Prior Blockers Reassessed

- Processing handoff after a failed terminal source is fixed. The R-13 migration
  now routes both successful ingestion completion and ingestion failure through
  `public.enqueue_ready_processing_runs`
  (`supabase/migrations/20260704165230_r13_preserve_processing_no_content.sql:76`,
  `supabase/migrations/20260704165230_r13_preserve_processing_no_content.sql:124`).
- Processing jobs are reachable after all flow sources are terminal. The helper
  checks the flow's source set, treats `completed` and `failed` as terminal, uses
  `processing_enqueued_at is null`, locks matching `processing_runs`, and sends
  an ID-only `processing-queue` message containing `type`, `flow_id`, and
  `cycle_date`.
- Terminal processing claim cleanup is implemented. Exhausted processing jobs
  delete undigested current-run `flow_articles` claims when no digest exists.
- `processing_enqueued_at` is now documented under `ProcessingRun`, matching the
  migration on `public.processing_runs`.
- Already-claimed articles are filtered before applying the 50-candidate cap in
  `processFlow`, and the focused test covers 50 newer claimed articles plus one
  older unclaimed article.
- Digest persistence and current-run article inclusion are handled in one
  service-role RPC transaction through `persist_processing_digest`.
- Existing-digest retries repair current-run article links before acknowledging
  success.
- Malformed structured output gets one bounded schema-repair request before
  final failure.

## Non-Blocking Findings

1. `supabase/functions/work/index.ts:910` - Local structured-output validation
   is looser than the strict schema sent to OpenAI. The parser validates required
   fields and broad types, but does not reject extra object keys despite the
   request schema using `additionalProperties: false`. Recommended disposition:
   add explicit key-set checks or a small shared JSON-schema validator in a
   follow-up hardening slice.

2. `supabase/migrations/20260704165230_r13_preserve_processing_no_content.sql:210`
   - `persist_processing_digest` is idempotent for normal retry paths, but two
   duplicate concurrent executions for the same run can still both observe no
   digest before one insert wins the unique constraint. The current queue lease
   and one-message handoff make this unlikely, so I do not consider it blocking
   for R-13. Recommended disposition: change the RPC to use
   `insert ... on conflict (processing_run_id)` or catch `unique_violation` and
   re-select the digest in a reliability hardening pass.

## Security and Constraint Review

- Queue payloads stay ID-only plus routing metadata.
- The worker enforces `gpt-5.4-mini` before provider calls, sends
  `max_output_tokens: 4000`, uses strict Responses structured output, and sets
  `store: false`.
- Article content is truncated to 2,000 Unicode characters per article and
  60,000 total article characters before the AI request.
- Provider errors are sanitized; the reviewed failure path does not record
  article bodies, prompts, API keys, or provider response bodies.
- Custom prompts are decrypted only inside the service-role worker path and are
  not logged by the new code.
- No committed real secrets, provider state, production data, `.env` values, or
  database dumps were found in the R-13 diff.

## Test Assessment

The focused processing tests cover no-content completion, claim/idempotency
behavior, strict request shape and usage persistence, already-claimed filtering
before the cap, existing-digest retry reuse and link repair, schema repair,
malformed schema rejection, and sanitized provider failure. Queue tests cover
processing handoff from terminal ingestion states and exhausted processing claim
cleanup. The final verifier report records the broader gates as passing,
including focused processing, focused queue, full unit, coverage, browser build,
e2e smoke, Supabase lint/integration, Deno checks, npm audit, OpenSpec strict
validation, and diff whitespace hygiene.
