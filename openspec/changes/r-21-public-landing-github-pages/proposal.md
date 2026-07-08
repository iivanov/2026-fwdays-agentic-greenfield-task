## Why

The project needs a public, shareable first screen that explains the AI news
desk before authentication, and the user requested GitHub Pages for static
hosting. This also simplifies the $0 public-repository deployment path by using
GitHub-native Pages and Actions for the browser shell (`BR-PROJ-01..03`,
`NFR-CON-04/07`, `T-02`, `T-04`, `T-14`).

## What Changes

- Replace the unauthenticated centered sign-in screen with a full landing page
  that introduces the product, shows the controlled daily digest workflow, and
  keeps Google/GitHub OAuth sign-in as the primary conversion action.
- Update the static frontend hosting decision from Vercel Hobby to GitHub Pages
  for the browser shell while keeping Supabase as the only backend/stateful
  runtime.
- Add a GitHub Actions workflow that builds the Vite browser package and
  deploys `packages/browser/dist` to GitHub Pages with the required Pages
  permissions and environment.
- Configure Vite so production assets can be served from a GitHub Pages
  repository subpath without breaking local development.
- Update documentation and verification evidence for the changed hosting path.

## Capabilities

### New Capabilities

- `public-landing-page`: Public unauthenticated landing page behavior, routing,
  and sign-in entry points for the React/Vite browser app.

### Modified Capabilities

- `deployment-bootstrap`: Replace the static frontend deployment contract from
  Vercel config to GitHub Pages Actions deployment while preserving the $0,
  static-only, no-secrets hosting boundary.

## Impact

- Affected code/config: `packages/browser/src/App.tsx`,
  `packages/browser/src/index.css`, `packages/browser/vite.config.ts`,
  `.github/workflows/`, and deployment audit/configuration files as needed.
- Affected docs: technology and hosting decision records, deployment setup
  guide, development process record, OpenSpec specs/tasks, and agent state.
- APIs/data/backend: no API, database, RLS, queue, Edge Function, provider
  secret, or paid-service behavior changes.
- Deployment: repository Pages settings still require a human with repository
  admin access to set the Pages source to GitHub Actions; no automatic push,
  deployment, provider account creation, or spending is performed by this
  change.
