# Review: hosted-cron-bootstrap-documentation

**Reviewer:** Independent reviewer
**Date:** 2026-07-10
**Change reviewed:** OpenSpec artifacts introduced in `8f2de36`; final
documentation implementation `80582f0`
**Verdict:** REQUEST CHANGES

## Blocking findings

1. **P1 — [docs/deployment_setup_guide.md:464](../../../docs/deployment_setup_guide.md#L464), [docs/deployment_setup_guide.md:550](../../../docs/deployment_setup_guide.md#L550): an arbitrary HTTP response is presented as proof that automatic cron is healthy.** The documented expected result only requires a recent `net._http_response` row "has an HTTP status," and the smoke checklist accepts that status so long as it is not the DNS error. However, all three scheduled functions return HTTP 401 for a missing/mismatched scheduler secret ([`schedule-daily`](../../../supabase/functions/schedule-daily/index.ts#L48), [`work`](../../../supabase/functions/work/handler.ts#L212), and [`cleanup`](../../../supabase/functions/cleanup/index.ts#L25)); 500 and 503 responses would also satisfy the stated success condition. An operator can therefore configure a bad secret, see a recent 401, mark cron healthy under the guide, and still receive no automatic reports—the exact operational failure this change is meant to prevent. Require fresh scheduled responses to have `error_msg IS NULL` and a 2xx `status_code` (and make the smoke checklist require that result) before enabling reports. Keep the existing 401 troubleshooting guidance as the failure path.

## Non-blocking findings

1. **P2 — [docs/deployment_setup_guide.md:457](../../../docs/deployment_setup_guide.md#L457): the `pg_net` query has no request/job identity.** `net._http_response` contains a request id, status, error, and timestamp, but not a target URL; its request-queue row is removed after execution. A response from another `pg_net` caller, or from `cleanup`, can thus be mistaken for the per-minute `work` response. The final smoke test's digest observation provides later end-to-end evidence, but the pre-enable verification query should say to inspect responses generated after the worker observation window and, where possible, corroborate the `work` Function invocation log. A future runtime change could persist request-id-to-job correlation if stronger SQL-only attribution is needed.

## Scope, security, and traceability assessment

- The guide correctly keeps the project URL and `SCHEDULER_SECRET` outside
  versioned migrations and does not reintroduce a service-role key into the
  database-setting instructions. The supplied checks expose only booleans and
  operational metadata, not setting values, headers, or response bodies.
- The diagnosis and repair direction match the installed cron migration:
  it dynamically reads `app.settings.supabase_url`, falls back to local
  `http://kong:8000`, and prefers `app.settings.scheduler_secret` for the
  authorization header ([migration](../../../supabase/migrations/20260707213346_use_scheduler_secret_for_cron_auth.sql#L20)). The explanation of why direct `curl` is not evidence for the scheduled path is accurate.
- The change traces its documentation requirement to `NFR-SEC-03`,
  `NFR-OPS-04`, `T-05`, `T-06`, `T-14`, `H-02`, and `H-06`, and updates the
  owning hosting record before the deployment guide. No product behavior,
  migration, or hosted state was changed.

## Evidence inspected

| Check | Result |
| --- | --- |
| Final documentation diff | Inspected `80582f0` directly; only documentation/state/task updates are present. |
| Cron/auth implementation | Inspected the final scheduler migration and all three function authorization paths. |
| OpenSpec artifact and traceability | `openspec validate hosted-cron-bootstrap-documentation --strict` passed. |
| Diff integrity | `git diff --check 80582f0^ 80582f0` passed. |
| `pg_net` response semantics | Checked the upstream `pg_net` schema: response rows contain `id`, status/error metadata, and timestamp but not the target URL. |

The independent verifier's report was not relied upon; it was not present at
the time of this review.
