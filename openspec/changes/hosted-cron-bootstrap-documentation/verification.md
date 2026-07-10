# Verification Report — Hosted Cron Bootstrap Documentation

**Verifier:** independent sub-agent  
**Change:** `hosted-cron-bootstrap-documentation`  
**Implementation reviewed:** `80582f0` (`docs: clarify hosted cron bootstrap`)  
**Scope:** documentation/OpenSpec artifacts only; no hosted Supabase mutation was performed.

| Gate | Command / method | Result | Evidence |
| --- | --- | --- | --- |
| Whitespace | `git diff --check 80582f0^ 80582f0` and `git diff --check HEAD` | PASS | Both commands completed with no output; the committed change and worktree have no whitespace errors. |
| OpenSpec validation | `openspec validate hosted-cron-bootstrap-documentation --strict && openspec validate --all --strict` | PASS | The change is valid; strict validation reported 26 passed and 0 failed items. |
| Local links and paths | Read-only Node Markdown-link target check over the four changed documents and four change artifacts | PASS | Validated 8 files; no local Markdown targets were missing. |
| Requirement traceability | Compared proposal, design, delta `deployment-bootstrap` specification, canonical hosting record, and operator guide | PASS | The guide implements the two delta scenarios: project-specific URL/scheduler-secret bootstrap with non-secret checks, and DNS diagnosis that directs operators to inspect active jobs/apply migrations rather than edit `cron.job`. Trace IDs include `NFR-SEC-03`, `NFR-OPS-04`, `T-05`, `T-06`, `T-14`, `H-02`, and `H-06`. |
| Cron/manual-path correctness | Compared the guide with `20260707213346_use_scheduler_secret_for_cron_auth.sql` and the three scheduled function handlers | PASS | Cron resolves `app.settings.supabase_url`, uses `app.settings.scheduler_secret` first, and calls through `net.http_post`; the handlers accept `SCHEDULER_SECRET`. The documented `curl` calls the public function URL directly with its supplied header, so it is accurately distinguished from cron/`pg_net` evidence. |
| Secret safety | Inspected changed SQL/Markdown and ran `npm run secrets:scan` | PASS | The SQL uses a project URL placeholder and `YOUR_SCHEDULER_SECRET`; verification queries only return configured/not-configured state and operational metadata. The guide explicitly excludes the service-role key from database settings. Gitleaks scanned about 23 MB of tracked files and reported no leaks. |
| Stale terminology | Searched tracked docs/configuration for cron database-setting terminology and reviewed changed guidance | PASS | Current deployment guidance requires only `supabase_url` and `scheduler_secret`; remaining `service_role_key` references are compatibility behavior in migrations/tests or dated historical process records, not active bootstrap instructions. |

## Scenario observations

- **New hosted project:** the guide provides portable, operator-entered settings, then requires active cron rows, job history, and a recent `net._http_response` HTTP result before reports are enabled. It does not instruct an operator to commit a project URL or secret.
- **DNS failure:** the guide identifies `Couldn't resolve host name` as a missing/incorrect hosted URL (commonly the `http://kong:8000` fallback), distinguishes an outdated stored job command, and directs the operator to apply current migrations rather than edit `cron.job`.

## Not applicable / not run

No TypeScript, Deno, unit, integration, browser, migration, or hosted-runtime gate applies to this documentation-only diff. No hosted credentials were supplied, and this verifier did not change provider configuration.

**Verdict:** PASS — all applicable documentation gates are green and both specified cron-bootstrap scenarios are accurately documented without secret exposure.
