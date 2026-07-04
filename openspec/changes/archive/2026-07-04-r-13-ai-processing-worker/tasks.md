## 1. OpenSpec and Traceability

- [x] 1.1 Create R-13 OpenSpec proposal, design, tasks, and capability spec.
- [x] 1.2 Update roadmap/state/development-process records with actual R-13 progress and evidence.

## 2. Processing Worker Implementation

- [x] 2.1 Implement flow/source/article selection for up to 50 newest unclaimed candidates.
- [x] 2.2 Implement `flow_articles` claims using `(flow_id, article_id)` as the idempotency boundary.
- [x] 2.3 Implement `no_content` completion without a digest when no articles are claimed.
- [x] 2.4 Implement n-gram Jaccard near-duplicate grouping.
- [x] 2.5 Enforce per-article and total input truncation budgets before AI calls.
- [x] 2.6 Implement OpenAI Responses strict structured output call and response parsing.
- [x] 2.7 Persist digest content, token usage, provider request ID, model, and included article links.
- [x] 2.8 Persist digest rows and included article links through one service-role RPC transaction.
- [x] 2.9 Implement one bounded schema repair attempt before failing malformed structured output.
- [x] 2.10 Enqueue processing jobs from ingestion completion once all flow sources are terminal.
- [x] 2.11 Release undigested current-run article claims when exhausted processing jobs are archived.
- [x] 2.12 Filter already-claimed articles before applying the 50-article processing cap.
- [x] 2.13 Enqueue processing jobs when the final source reaches terminal state through failure.

## 3. Automated Tests

- [x] 3.1 Add Vitest coverage for empty candidate `no_content`.
- [x] 3.2 Add Vitest coverage for candidate claiming/idempotency and included flow article updates.
- [x] 3.3 Add Vitest coverage for near-duplicate grouping and input truncation.
- [x] 3.4 Add Vitest coverage for strict output parsing, usage persistence, and safe provider failure handling.
- [x] 3.5 Add Vitest coverage for existing-digest retry link repair and schema repair attempts.
- [x] 3.6 Add queue/migration regression coverage for processing handoff and terminal claim cleanup.
- [x] 3.7 Add regression coverage for older unclaimed articles behind 50 newer claimed articles.
- [x] 3.8 Add queue/migration regression coverage for failed-ingestion processing handoff.

## 4. Verification and Handoff

- [x] 4.1 Run narrow maker self-checks for the touched code.
- [x] 4.2 Spawn independent verifier and reviewer sub-agents on the final diff.
- [x] 4.3 Resolve blocking checker findings, rerun final checks, and archive only after green verification plus review approval.
