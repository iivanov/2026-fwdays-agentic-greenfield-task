# Independent Verification: R-17 Observability Guardrails

Verifier role: independent checker. Date: 2026-07-05. This pass verified the
current final diff for `r-17-observability-guardrails` after the
schema-repair AI budget bypass blocker fix. I did not edit implementation code.

## Scope Inspected

- Root `AGENTS.md`, `docs/*`, architecture docs, package scripts, Supabase
  configuration, and workflow inventory.
- `npx -y @fission-ai/openspec@1.5.0 show r-17-observability-guardrails`.
- `openspec/changes/r-17-observability-guardrails/tasks.md` and delta spec.
- `git diff --stat` and targeted diffs for
  `supabase/functions/work/index.ts`,
  `packages/browser/src/lib/processing-worker.test.ts`,
  `packages/browser/src/lib/queue-worker.test.ts`, and
  `supabase/migrations/20260705102552_r17_observability_guardrails.sql`.

## Behavioral Checks

- Over-budget malformed OpenAI responses are budget-checked before schema
  validation/repair: `callOpenAiDigest` extracts response metadata, invokes
  `onOpenAiResponse`, and only then parses the structured output.
- The over-budget malformed response regression test proves a single provider
  call, no repair attempt, no digest persistence, and a `record_ai_usage_event`
  entry with `outcome = failed_budget`.
- Under-budget schema-invalid responses are ledgered before the repair attempt:
  `callOpenAiDigest` invokes `onOpenAiSchemaInvalid`, and `processFlow` records
  `outcome = failed_provider` before `callOpenAiDigestWithSchemaRepair` makes
  the one bounded repair call.
- Budget exhaustion propagates as `ai_budget_exhausted`; the worker catches that
  code for processing jobs, calls `fail_terminal_processing_worker_job`, returns
  HTTP 200 with `processing_failed_terminal`, and does not call the retry path.
- The migration backs that runtime path with content-free `ai_usage_events`,
  `record_ai_usage_event`, `get_ai_token_usage_since` that sums successful
  digests plus failed usage events, and a terminal queue acknowledgement RPC.

| Gate | Command | Result | Evidence |
|------|---------|--------|----------|
| OpenSpec change inspection | `npx -y @fission-ai/openspec@1.5.0 show r-17-observability-guardrails` | pass | Rendered the R-17 proposal and traceability. |
| Task inspection | `cat openspec/changes/r-17-observability-guardrails/tasks.md` | pass | Tasks 1.1 through 4.1 checked; 4.2 remains pending this checker loop. |
| Diff inspection | `git diff --stat` and targeted diffs | pass | Diff is scoped to R-17 env placeholders, docs/state, focused tests, Edge Functions, OpenSpec artifacts, and one migration. |
| Focused R-17 tests | `npx vitest run packages/browser/src/lib/queue-worker.test.ts packages/browser/src/lib/processing-worker.test.ts` | pass | `Test Files 2 passed (2)`, `Tests 31 passed (31)`. |
| Deno Edge check | `npm run deno:check` | pass | `deno check ... api/index.ts ... work/index.ts` exited 0. |
| Deno Edge lint | `npm run deno:lint` | pass | `Checked 4 files`. |
| Deno Edge format | `npm run deno:fmt` | pass | `Checked 10 files`. |
| Strict typecheck | `npm run typecheck` | pass | `tsc --build --noEmit` exited 0. |
| ESLint | `npm run lint` | pass | `eslint .` exited 0. |
| Prettier format | `npm run format` | pass | `All matched files use Prettier code style!`. |
| Unit tests | `npm run test` | pass | `Test Files 12 passed (12)`, `Tests 152 passed (152)`. |
| Supabase migration lint | `npm run supabase:lint` | pass on retry | Final run reached the local database and reported `No schema errors found`, `{"results":[],"message":"db lint"}`. |
| Supabase integration tests | `npm run test:integration` | pass | `Test Files 3 passed (3)`, `Tests 5 passed (5)`. |
| OpenSpec strict validation | `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` | pass | `Totals: 17 passed, 0 failed (17 items)`. |
| Whitespace diff check | `git diff --check` | pass | Exited 0 with no output. |
| Combined local gate | `npm run verify:local` | pass | Completed typecheck, lint, format, tests, coverage, Deno check/lint/fmt/lock/outdated, npm audit, browser build, and Playwright smoke. Unit and coverage phases each reported `Tests 152 passed`; coverage statements `85.62%`; Playwright `1 passed`. |
| Workflow lint | `actionlint .github/workflows/actionlint.yml .github/workflows/ci.yml .github/workflows/codeql.yml .github/workflows/dependency-review.yml` | pass | Exited 0 with no output. |

## Notes

- The first `npm run supabase:lint` reached the local database and reported no
  schema errors, but exited nonzero because the Supabase CLI timed out while
  shutting down PostHog telemetry. A telemetry-disabled immediate rerun failed
  to connect to Postgres. `npx supabase status` then showed the project stack
  and database endpoint, and the final `npm run supabase:lint` rerun passed.
- CodeQL and Dependency Review are GitHub Actions gates, not locally executed by
  this verifier pass.

## Verdict

PASS. The requested gates and feasible broader local gates passed against the
current final diff. The schema-repair budget bypass is closed in the inspected
runtime path: over-budget malformed responses do not repair, failed usage is
durably accounted, under-budget schema-invalid responses are ledgered before the
one repair attempt, and exhausted processing jobs are terminally acknowledged
instead of retried for repeated provider spending.
