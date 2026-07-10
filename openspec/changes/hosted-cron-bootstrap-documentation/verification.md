# Final Verification Report — Hosted Cron Bootstrap Documentation

**Verifier:** independent sub-agent
**Implementation reviewed:** `fbaed63` (`fix: use Vault for hosted cron configuration`)
**Scope:** Vault-backed cron migration, focused regression coverage, and deployment/OpenSpec documentation.

This final report supersedes the prior documentation-only verification of
`80582f0`. It does not rely on maker claims.

| Gate | Command / method | Result | Evidence |
| --- | --- | --- | --- |
| Focused migration-source regression | `npx vitest run packages/browser/src/lib/queue-worker.test.ts` | PASS | 1 file and all 24 tests passed, including the Vault-backed cron source assertions. |
| Local integration/status path | `npm run test:integration` | PASS | 3 integration files and all 5 tests passed. The launcher obtained local Supabase status internally without printing its credentials. |
| Strict OpenSpec | `openspec show hosted-cron-bootstrap-documentation`, `openspec validate hosted-cron-bootstrap-documentation --strict`, and `openspec validate --all --strict` | PASS | The change is valid; strict validation reported 26 passed and 0 failed items. |
| Migration/authorization inspection | Independent review of the migration, scheduled function handlers, and final guide | PASS | All three jobs call the allowlisted private helper; its stored commands contain only paths, not the URL or scheduler secret. The helper reads named Vault values, calls `net.http_post`, rejects missing values, revokes `PUBLIC`, and grants execution only to `postgres`. Handlers accept `SCHEDULER_SECRET`; guide correctly distinguishes direct `curl` from cron/`pg_net` evidence. |
| Current Supabase guidance | Official Supabase Vault and pg_net documentation | PASS | The implementation uses the documented `vault.create_secret()` / encrypted Vault model and asynchronous `net.http_post` model. |
| Whitespace, formatting, secret scan, and local Markdown paths | Not completed before the verification time limit | NOT RUN | The first combined check exposed trailing spaces in the superseded verifier report. This replacement removes them, but the full final check was not rerun before handoff. |
| Local migration reset/lint and installed cron/privilege query | Not runnable in this sandbox | NOT RUN | `supabase` is not on `PATH`; the locally installed CLI attempted to write telemetry under read-only `~/.supabase`. An escalation request was cancelled. Docker socket access is also denied, so direct local cron inspection was not possible. |

## Scenario assessment

- The new Vault bootstrap documentation provides the two exact named entries,
  avoids a service-role entry, and requires successful scheduled HTTP evidence
  before reports are enabled.
- The migration removes the `kong` fallback and prior `app.settings.*` lookup
  from the recreated jobs. Missing Vault data fails with a name-only error,
  while the guide directs operators to create the entry or apply migrations;
  it does not direct edits to `cron.job`.

## Verdict

**FAIL (verification incomplete).** Focused source coverage, integration
coverage, strict OpenSpec validation, and the static security/path assessment
pass. The applicable final formatting/secret/path checks and local
reset/lint/cron-runtime observation remain unrun; they must be green before
this change is archived.
