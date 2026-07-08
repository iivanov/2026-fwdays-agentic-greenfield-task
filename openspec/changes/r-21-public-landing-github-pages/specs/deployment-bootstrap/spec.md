## MODIFIED Requirements

### Requirement: Static Frontend Deployment Config

The repository SHALL provide GitHub Pages deployment configuration for the
React/Vite browser SPA that builds static assets only, publishes
`packages/browser/dist` through a GitHub Actions Pages artifact, supports
client-side route fallback for direct links, and does not introduce any
frontend-hosted API/runtime behavior (satisfies `BR-PROJ-01..03`,
`NFR-CON-04..08`, `A-01`, `A-06`, `T-04`, `T-14`, `H-01`, `H-04`, `H-06`).

#### Scenario: GitHub Pages workflow exists

- **WHEN** the deployment audit validates repository configuration
- **THEN** `.github/workflows/pages.yml` builds the browser workspace with
  `npm ci` and `npm run build --workspace @news-aggregator/browser`
- **AND** the workflow uploads `packages/browser/dist` as the Pages artifact
- **AND** the workflow deploys through the `github-pages` environment with the
  minimum Pages permissions required for GitHub Pages Actions deployment

#### Scenario: GitHub Pages build remains static-only

- **WHEN** the GitHub Pages workflow and browser build output are validated
- **THEN** the workflow contains no serverless function, cron, external API
  proxy, provider secret, or paid-hosting configuration that would move backend
  runtime behavior into GitHub Pages or GitHub Actions

#### Scenario: SPA direct-link fallback is emitted

- **WHEN** the browser build completes for GitHub Pages
- **THEN** the generated artifact contains both `index.html` and `404.html` so
  direct requests to client-side routes can load the browser app on GitHub Pages

#### Scenario: GitHub Pages base path is configurable

- **WHEN** the browser app is built in GitHub Actions for a project Pages site
- **THEN** Vite asset URLs are emitted under the repository subpath by default
- **AND** a custom `VITE_PUBLIC_BASE_PATH` can override the default for user
  pages or custom domains

### Requirement: Human-Gated Provider Bootstrap

The repository SHALL document and audit provider bootstrap boundaries without
committing secrets, generated provider state, production data, or private
configuration (satisfies `BR-PROJ-02..03`, `NFR-SEC-03`, `NFR-CON-04..08`,
`AT-01`, `T-14`, `H-02..H-06`, `Q-05`).

#### Scenario: Required secret names are discoverable

- **WHEN** a developer inspects `.env.example` or runs the deployment audit
- **THEN** all required browser, Supabase, OAuth, OpenAI, Brevo, Telegram,
  scheduler, and encryption variable names are listed without values

#### Scenario: Provider state remains untracked

- **WHEN** a developer links Supabase projects or configures repository Pages
  settings locally
- **THEN** generated provider state and `.env` files are ignored or reported as
  unsafe to commit

#### Scenario: Human-only actions remain explicit

- **WHEN** the deployment audit runs without provider credentials
- **THEN** it reports account creation, project linking, GitHub Pages source
  selection, OAuth app setup, secret entry, hosted branch protection/security
  settings, and production deploy as human-bootstrap items instead of silently
  passing them
