# Final Review: hosted-cron-bootstrap-documentation

**Reviewer:** Independent reviewer
**Date:** 2026-07-10
**Final implementation reviewed:** `1da669a`
**Verdict:** REQUEST CHANGES

## Blocking finding

1. **P1 — [verification.md:25](verification.md#L25): the final independent verifier reports `FAIL (verification incomplete)`.** The prior stale-report and whitespace defects are fixed: this report covers the Vault migration, and `git diff --check 80582f0..1da669a` now passes. However, the final verifier explicitly records its formatting/secret/path checks and local migration reset/lint/cron-privilege observation as not run, then gives a failing verdict. Under the required maker≠checker gate, the reviewer cannot certify a change whose final verifier has failed. Have the verifier complete the applicable final checks or formally resolve which unavailable prerequisites do not block this documentation/migration change, then update `verification.md` to a final PASS before archive.

## Resolved prior findings

- The guide now requires a fresh 2xx `pg_net` response with no error and does
  not accept a 401/5xx as evidence that automatic cron is healthy.
- It acknowledges that `net._http_response` cannot identify a job/URL and
  requires a next-minute worker observation corroborated in Function logs.
- The duplicated task continuation lines are removed.
- The verification artifact supersedes the former `80582f0` documentation-only
  report and contains no trailing whitespace.

## Implementation assessment

- [Vault migration](../../../supabase/migrations/20260710100511_vault_backed_hosted_cron.sql)
  reads only named encrypted Vault values at execution time, has a fixed path
  allowlist, and rejects missing values before any HTTP request. The stored
  cron commands contain neither the hosted URL nor scheduler secret and no
  longer include the local `kong` fallback.
- The non-exposed helper is `SECURITY INVOKER`; `PUBLIC` execution is revoked
  and only `postgres` receives `EXECUTE`. This avoids exposing
  `vault.decrypted_secrets`, does not introduce `SECURITY DEFINER`, and does
  not use a service-role key for cron.
- The daily, one-minute worker, and 30-minute cleanup schedules are recreated
  with their intended paths. The deployment guide's Vault bootstrap, 401/DNS/
  missing-entry diagnoses, and direct-`curl` distinction match the migration
  and Edge Function authorization paths.
- The OpenSpec delta and hosting record trace the repair to `NFR-SEC-03`,
  `NFR-OPS-04`, `T-05`, `T-06`, `T-14`, `H-02`, and `H-06`.

## Evidence

| Check | Result |
| --- | --- |
| Final migration/docs/tasks inspection | PASS; no new secret exposure, public execution path, local fallback, or schedule regression found. |
| Diff integrity | `git diff --check 80582f0..1da669a` passed. |
| Strict OpenSpec | `openspec validate hosted-cron-bootstrap-documentation --strict` passed. |
| Final verifier evidence | Focused source tests and integration tests pass, but its verdict is FAIL because final formatting/secret/path checks and local reset/lint/cron observation are not run. |

I independently inspected the final code/docs and used the verifier only for
its recorded test outcomes and unavailable-gate status.
