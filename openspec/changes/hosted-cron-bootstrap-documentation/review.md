# Final Review: hosted-cron-bootstrap-documentation

**Reviewer:** Independent reviewer
**Date:** 2026-07-10
**Final implementation reviewed:** `fbaed63`
**Verdict:** REQUEST CHANGES

## Blocking findings

1. **P1 — [verification.md:3](verification.md#L3): the final implementation has no valid independent verification artifact, and its committed change fails the required whitespace gate.** `verification.md` explicitly covers only `80582f0` and calls the work documentation-only; it does not verify the Vault migration, its grants, schedules, or the revised deployment instructions in `fbaed63`. Moreover, `git diff --check 80582f0..fbaed63` reports trailing whitespace on lines 3--5 of that artifact. This violates the documentation/change gate and cannot certify the final migration after the maker changed it. Remove the trailing whitespace, then have a separate verifier run and record the final migration/documentation gates (at minimum reset/lint or an explicit unavailable-prerequisite result, focused/full tests, secret scan, diff check, and strict OpenSpec validation) against the final commit.

## Prior findings

- **Resolved P1 (HTTP success criterion):** [deployment_setup_guide.md:472](../../../docs/deployment_setup_guide.md#L472) now requires a fresh response with `error_msg IS NULL` and a 2xx status; the smoke checklist repeats that condition. This no longer accepts a 401/5xx response as evidence of operational cron.
- **Resolved P2 (response attribution):** [deployment_setup_guide.md:475](../../../docs/deployment_setup_guide.md#L475) now acknowledges that `net._http_response` has no job/URL identity and requires a next-minute worker observation plus timestamp corroboration in the `work` Function logs.

## Implementation assessment

- The new migration reads only the two named Vault values at execution time and
  validates a fixed allowlist of Edge Function paths. Its recreated `cron.job`
  commands contain only calls to the helper, so neither a project URL nor
  scheduler secret is stored in cron metadata.
- It uses `SECURITY INVOKER`, revokes the default `PUBLIC` grant, and grants the
  helper only to `postgres`. The migrations schedule the jobs as the migration
  role, so this retains least-privilege access to `vault.decrypted_secrets` and
  `net.http_post`; no `SECURITY DEFINER`, public schema function, or service-role
  key is introduced.
- The helper rejects unknown paths and missing Vault entries before it can make
  an HTTP request. It removes the local `kong` fallback and preserves the
  intended daily/minutely/30-minute schedules.
- The deployment guide creates named Vault values without committing their
  values, excludes the service-role key, distinguishes direct `curl` from the
  scheduled path, and includes DNS, missing-Vault, and 401 repair paths.
- Traceability is present in the proposal/spec and hosting record for
  `NFR-SEC-03`, `NFR-OPS-04`, `T-05`, `T-06`, `T-14`, `H-02`, and `H-06`.

## Non-blocking finding

1. **P2 — [tasks.md:18](tasks.md#L18), [tasks.md:24](tasks.md#L24): duplicated task continuation text.** The final task file repeats the end of items 1.6 and 2.1. Clean the duplicated lines when fixing the final verification artifact; it does not affect migration behavior.

## Evidence independently inspected

| Check | Result |
| --- | --- |
| Final migration, grants, schedules, and function auth paths | Inspected; no secret value, local fallback, or public helper execution path found. |
| Focused source regression test | `npx vitest run packages/browser/src/lib/queue-worker.test.ts` passed: 24 tests. |
| Secret scan | `npm run secrets:scan` passed: no tracked leaks. |
| Strict OpenSpec validation | `openspec validate hosted-cron-bootstrap-documentation --strict` passed. |
| Final diff integrity | Failed: `git diff --check 80582f0..fbaed63` reports the three trailing-whitespace lines in `verification.md`. |
| Local Supabase reset/lint | Not independently completed: the CLI reset/lint attempt was interrupted before completion. The existing verifier report cannot substitute because it predates the Vault migration. |
