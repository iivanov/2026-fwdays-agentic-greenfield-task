# Independent Review

Reviewer: Leibniz (sub-agent)
Date: 2026-07-04
Change: `r-11h-harden-outbound-ssrf`
Verdict: REQUEST CHANGES

## Blocking Findings

1. `supabase/functions/api/helpers.ts:230` and
   `supabase/functions/api/helpers.ts:268` -- the second, immediate pre-fetch
   SSRF validation can throw outside the function's declared result contract.
   If Slack or generic webhook DNS is safe during the initial `validateUrlSsrf`
   call but rebinds to `127.0.0.1` during `fetchWithSsrfProtection`,
   `SsrfProtectionError` escapes instead of returning
   `{ success: false, error: ... }`; depending on caller behavior this becomes a
   500 rather than a controlled verification rejection. Wrap
   `fetchWithVerificationTimeout` for Slack/webhook in `try/catch`, map
   `SsrfProtectionError` and fetch/abort failures to
   `{ success: false, error: ... }`, and keep fetch uninvoked on unsafe targets.

## Non-Blocking Findings

1. `supabase/functions/api/ssrf.ts:341` -- redirect limit handling validates one
   extra redirect target after the allowed redirect budget is exhausted. With
   `maxRedirects: 3`, the fourth redirect response's `Location` is
   DNS-validated before throwing `Too many redirects`, even though that target
   will never be fetched. Consider checking the redirect budget before resolving
   the next target to avoid unnecessary DNS lookups and cleaner behavior.

## Evidence

The reviewer inspected implementation snippets for `validateUrlSsrf`,
`assertUrlSsrfSafe`, `fetchWithSsrfProtection`, `fetchWithVerificationTimeout`,
`verifyDeliveryChannelTarget`, and the cited test snippets. The reviewer relied
on maker-reported gate evidence and did not independently rerun gates.

## Disposition

- Blocking finding 1: fixed in the follow-up patch by mapping Slack/generic
  webhook protected-fetch failures to safe verification errors and adding
  regressions.
- Non-blocking finding 1: left documented for a later cleanup because the extra
  DNS lookup does not fetch the target and does not violate the R-11H acceptance
  criteria.

## Final Review

Reviewer: Faraday (sub-agent)
Date: 2026-07-04
Change: `r-11h-harden-outbound-ssrf`
Verdict: APPROVE

### Blocking Findings

None.

### Non-Blocking Findings

1. `supabase/functions/api/ssrf.ts:349` -- redirect budget still validates one
   extra redirect target after the allowed redirect fetches are exhausted. A
   long redirect chain can cause one additional DNS/URL validation before
   `Too many redirects`, but no fetch is made for that extra target. Keep as
   non-blocking or adjust loop structure later so the budget check happens
   before resolving the next redirect target.

### Evidence

The reviewer inspected the repaired diff, `verifyDeliveryChannelTarget` in
`supabase/functions/api/helpers.ts`, the repaired Slack and webhook branches,
`fetchWithVerificationTimeout`, `fetchWithSsrfProtection`, and the new
regression tests in `packages/browser/src/lib/api-helpers.test.ts`.

The reviewer relied on the provided gate evidence for:

- `npm run test -- packages/browser/src/lib/api-helpers.test.ts packages/browser/src/lib/ssrf.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format`
- `npm run deno:check`
- `npx -y @fission-ai/openspec@1.5.0 validate r-11h-harden-outbound-ssrf --strict`
- `git diff --check`
