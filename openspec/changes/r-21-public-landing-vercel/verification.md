# Verification — R-21 Public Landing Page on Vercel

Date: 2026-07-08

## Result

Maker local verification passed for the Vercel-hosted landing page change.
Independent verifier/reviewer sub-agents were not run in this turn because the
available sub-agent tool is restricted to explicit user-requested delegation.
This remains a process evidence gap before archive/production-readiness claims.

## Gates Run

| Gate | Result | Evidence |
| --- | --- | --- |
| OpenSpec change validation | PASS | `openspec validate r-21-public-landing-vercel --strict` |
| Strict typecheck | PASS | `npm run typecheck` |
| ESLint | PASS | `npm run lint` |
| Prettier check | PASS | `npm run format` |
| Unit tests | PASS | `npm run test` (16 files, 171 tests) |
| Deployment audit | PASS | `npm run infra:audit` |
| Browser build | PASS | `npm run build:browser` |
| Browser smoke E2E | PASS | `npx playwright test tests/e2e/browser-smoke.spec.ts --reporter=list` (12 Chromium tests) |
| OpenSpec all strict | PASS | `openspec validate --all --strict` (21 items) |
| Diff whitespace | PASS | `git diff --check` |

## Visual Check

Captured local dev screenshots after fixing no-env public landing rendering:

- Desktop: `/tmp/news-landing-desktop.png`
- Mobile: `/tmp/news-landing-mobile.png`

The screenshots showed the hero image, headline, OAuth actions, proof metrics,
and mobile stack without obvious overlap.

## Notes

- The browser landing page now renders without local Supabase browser env vars;
  OAuth/dev auth actions report a configuration error instead of crashing.
- `vercel.json` remains the deployment contract for static hosting, SPA
  fallback, cache headers, browser hardening headers, font endpoints, and
  Supabase browser connections.
