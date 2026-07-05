# Independent Review Report

Change: `r-20-browser-auth-lifecycle`
Reviewer role: independent checker
Date: 2026-07-05
Verdict: **APPROVE**

## Blocking Findings

None.

## Non-Blocking Findings

1. `openspec/changes/r-20-browser-auth-lifecycle/verification.md:31` - The verifier report says the Playwright gate passed 8 Chromium tests, while the current `tests/e2e/browser-smoke.spec.ts` contains 10 tests and project state records 10. Failure scenario: archive readers may not be able to tell whether the verifier evidence was captured before or after the two regression tests for callback-error precedence and remote sign-out failure were added. Fix direction: before archive, either rerun/refresh the verifier report or correct the recorded Playwright test count if it is only a transcription error.

## Review Notes

- Inspected the current worktree diff and untracked R-20 files against `proposal.md`, `design.md`, `tasks.md`, the R-20 `supabase-auth` delta, and `openspec/specs/supabase-auth/spec.md`.
- The previous callback-error blocker is fixed: `packages/browser/src/App.tsx:72` now gets callback errors through `currentCallbackError()`, which is gated by `isAuthCallbackPath()` at `packages/browser/src/App.tsx:522`; the regression at `tests/e2e/browser-smoke.spec.ts:44` covers OAuth-like error parameters outside `/auth/callback`.
- The previous logout blocker is fixed: `packages/browser/src/App.tsx:202` clears local return path, tab state, browser path, and `session` before remote `supabase.auth.signOut()` completes; `tests/e2e/browser-smoke.spec.ts:103` covers the remote sign-out failure fixture.
- OAuth redirect initiation uses a same-origin `/auth/callback` redirect at `packages/browser/src/App.tsx:155`, and safe return paths are constrained to dashboard routes by `packages/browser/src/lib/auth-routing.ts:39`.
- Production-hidden password auth is implemented by `packages/browser/src/App.tsx:23` and `packages/browser/src/lib/auth-routing.ts:81`; the e2e shell check at `tests/e2e/browser-smoke.spec.ts:3` asserts the dev login controls are absent in the e2e production-like build.
- E2E fixture isolation remains scoped to `MODE=e2e`, `VITE_E2E_DASHBOARD_FIXTURE=1`, and `fixture=dashboard` at `packages/browser/src/App.tsx:513`, with callback errors taking precedence at `tests/e2e/browser-smoke.spec.ts:34`.
- The Telegram DNS resolver repair is correct: `supabase/functions/api/helpers.ts:281` now passes the injected resolver into the SSRF-protected Telegram verification fetch, and `packages/browser/src/lib/api-helpers.test.ts:1537` supplies a public Telegram IP fixture.
- I relied on the independent verifier artifact for gate outcomes, with the non-blocking count discrepancy noted above. I did not edit production code.
