## ADDED Requirements

### Requirement: Static Frontend Deployment Config
The repository SHALL provide Vercel configuration for the React/Vite browser
SPA that serves static assets only, defines client-side route fallback, applies
security headers, and does not introduce Vercel API/runtime behavior
(satisfies `BR-PROJ-01..03`, `NFR-CON-04..08`, `A-01`, `A-06`, `T-04`,
`T-14`, `H-01`, `H-04`, `H-06`).

#### Scenario: Vercel SPA config exists
- **WHEN** the deployment audit validates repository configuration
- **THEN** `vercel.json` defines the Vite framework, browser workspace install/build/output settings, and a fallback rewrite from non-asset routes to `index.html`

#### Scenario: Vercel remains static-only
- **WHEN** `vercel.json` is validated
- **THEN** it contains no function, cron, or external API proxy configuration that would move backend runtime behavior into Vercel

#### Scenario: Security headers are configured
- **WHEN** the deployed frontend serves static routes through Vercel
- **THEN** responses include baseline anti-framing, nosniff, referrer, permissions, HSTS, cache, and content-security headers suitable for a static authenticated SPA

### Requirement: Human-Gated Provider Bootstrap
The repository SHALL document and audit provider bootstrap boundaries without
committing secrets, generated provider state, production data, or private
configuration (satisfies `BR-PROJ-02..03`, `NFR-SEC-03`, `NFR-CON-04..08`,
`AT-01`, `T-14`, `H-02..H-06`, `Q-05`).

#### Scenario: Required secret names are discoverable
- **WHEN** a developer inspects `.env.example` or runs the deployment audit
- **THEN** all required browser, Supabase, OAuth, OpenAI, Brevo, Telegram, scheduler, and encryption variable names are listed without values

#### Scenario: Provider state remains untracked
- **WHEN** a developer links Vercel or Supabase projects locally
- **THEN** generated provider state and `.env` files are ignored or reported as unsafe to commit

#### Scenario: Human-only actions remain explicit
- **WHEN** the deployment audit runs without provider credentials
- **THEN** it reports account creation, project linking, OAuth app setup, secret entry, hosted branch protection/security settings, and production deploy as human-bootstrap items instead of silently passing them

### Requirement: Idempotent Deployment Audit
The repository SHALL provide an idempotent read-only audit command for
deployment configuration and human bootstrap readiness (satisfies `AT-01`,
`AT-11`, `NFR-OPS-04`, `T-13`, `T-14`, `H-06`, `Q-03..Q-05`).

#### Scenario: Audit validates committed config
- **WHEN** `npm run infra:audit` is executed from the repository root
- **THEN** it validates committed deployment configuration, required scripts, required environment variable names, ignored private paths, and OpenSpec/docs presence without requiring provider credentials

#### Scenario: Audit is secret-safe
- **WHEN** `npm run infra:audit` executes in an environment that contains secret values
- **THEN** it reports only variable names and configuration status, never secret values

#### Scenario: Audit is non-mutating
- **WHEN** `npm run infra:audit` or the bootstrap helper is executed repeatedly
- **THEN** it does not create provider accounts, link projects, deploy, enable paid features, mutate GitHub settings, or write provider state
