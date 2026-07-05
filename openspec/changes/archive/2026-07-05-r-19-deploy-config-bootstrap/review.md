# Independent Review: r-19-deploy-config-bootstrap

**Verdict:** APPROVE

## Blocking Findings

None.

## Non-Blocking Findings

1. `vercel.json:19` - The baseline CSP uses broad `connect-src 'self' https: wss://*.supabase.co` because the final hosted origins are not yet known. This is consistent with the R-19 design trade-off and does not violate the slice, but it should be tightened after human bootstrap records the exact Supabase and frontend origins.

## Evidence Inspected

- Read `AGENTS.md`, `docs/README.md`, `docs/architecture/4_technology/hosting.md`, `docs/architecture/4_technology/technology_requirements.md`, and the R-19 OpenSpec proposal/design/tasks/spec deltas.
- Inspected the current diff and untracked R-19 files directly, including `vercel.json`, `infra/scripts/audit-deployment.mjs`, `infra/scripts/bootstrap-check.mjs`, `.env.example`, `.gitignore`, `.github/workflows/ci.yml`, `package.json`, `eslint.config.js`, `packages/browser/src/lib/deployment-audit.test.ts`, `docs/state.md`, `docs/roadmap.md`, and `docs/development_process.md`.
- Confirmed the `.agents` deletion shown in `git status` is the documented symlink workaround and did not treat it as part of R-19.
- Checked current Vercel documentation for repository-owned `vercel.json` project configuration plus rewrites/headers behavior. The committed config uses supported file-based properties, keeps rewrites same-application only, and does not add functions, cron, or API proxying.
- Ran reviewer spot checks:
  - `npm run infra:audit` passed and printed only variable names/status plus human-bootstrap items.
  - `npm run infra:bootstrap-check` passed and reported read-only human-gated actions.
  - `npx vitest run packages/browser/src/lib/deployment-audit.test.ts` passed: 1 file, 2 tests.
  - `openspec validate r-19-deploy-config-bootstrap --strict` passed.

## Assessment

The R-19 diff satisfies the OpenSpec scenarios for static Vercel frontend deployment config, human-gated provider bootstrap, and idempotent deployment audit. The audit/bootstrap scripts are local read-only checks, do not call provider mutation APIs, do not create link state, and do not print secret values. `.env.example` remains value-free and `.gitignore` covers `.env.*`, `.vercel/`, and Supabase generated state. CI and `verify:local` now include `npm run infra:audit`, and focused tests exercise the key secret-safety and static-only Vercel assertions.

Human bootstrap remains correctly documented as unresolved rather than falsely certified: account/project creation, provider linking, secret entry, hosted repository security settings, and production deployment still require human action and later hosted evidence.
