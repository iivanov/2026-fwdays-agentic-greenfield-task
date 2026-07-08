## Why

The project needs a public, shareable first screen that explains the AI news
desk before authentication while preserving the selected Vercel static hosting
path for the browser app. The landing page makes the public Vercel deployment
useful before sign-in without adding backend runtime or cost (`BR-PROJ-01..03`,
`NFR-CON-04/07`, `T-02`, `T-04`, `T-14`).

## What Changes

- Replace the unauthenticated centered sign-in screen with a full landing page
  that introduces the product, shows the controlled daily digest workflow, and
  keeps Google/GitHub OAuth sign-in as the primary conversion action.
- Preserve the existing Vercel static frontend hosting contract and SPA fallback
  while keeping Supabase as the only backend/stateful runtime.
- Update Vercel static security headers as needed for the landing page assets
  and fonts.
- Update documentation and verification evidence for the public landing shell
  on Vercel.

## Capabilities

### New Capabilities

- `public-landing-page`: Public unauthenticated landing page behavior, routing,
  and sign-in entry points for the React/Vite browser app.

### Modified Capabilities

- `deployment-bootstrap`: Replace the static frontend deployment contract from
  an authenticated-only browser shell to a Vercel-hosted public landing shell
  while preserving the $0, static-only, no-secrets hosting boundary.

## Impact

- Affected code/config: `packages/browser/src/App.tsx`,
  `packages/browser/src/index.css`, `packages/browser/index.html`,
  `vercel.json`, tests, and deployment audit/configuration files as needed.
- Affected docs: technology and hosting decision records, deployment setup
  guide, development process record, OpenSpec specs/tasks, and agent state.
- APIs/data/backend: no API, database, RLS, queue, Edge Function, provider
  secret, or paid-service behavior changes.
- Deployment: Vercel remains the browser host; no automatic push, deployment,
  provider account creation, external account setup, or spending is performed by
  this change.
