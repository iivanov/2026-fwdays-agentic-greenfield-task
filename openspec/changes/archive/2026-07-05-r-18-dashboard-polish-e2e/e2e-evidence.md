# R-18 Maker Behavioral Evidence

Date: 2026-07-05

This is maker-run evidence only. Independent verifier and reviewer reports are
still required before archive.

## Commands

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused dashboard unit | pass | `npx vitest run packages/browser/src/lib/dashboard-summary.test.ts` reported 1 file and 2 tests passed. |
| Browser build | pass | `npm run build:browser` completed Vite production build. |
| Browser e2e | pass | `npm run test:e2e` reported 3 Chromium tests passed: login shell, desktop authenticated overview, and mobile digest feedback. |
| Combined local gate | pass | `npm run verify:local` passed, including typecheck, lint, format, 154 unit tests, coverage, Deno gates, npm audit, browser build, and 3 Playwright tests. |
| OpenSpec strict validation | pass | `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` reported 18 passed, 0 failed. |
| Diff hygiene | pass | `git diff --check` exited 0. |

## Behavior Observed

- The login shell remains available without the e2e dashboard fixture query.
- The authenticated fixture dashboard renders the operational overview at
  desktop width with digest history, flow status, and source warnings.
- The mobile viewport keeps dashboard navigation and digest feedback controls
  reachable without horizontal overflow.
- The mobile viewport test also visits Preferences, Sources, Flows, Delivery,
  and Digests to guard the existing authenticated panels against overflow.
