## Why

To guarantee project quality and maintain code health automatically, we need to enforce our static quality gates (type checking, linting, formatting, tests) on every pull request and commit using GitHub Actions. In addition, we need to protect our public repository against secret leakage, out-of-date/vulnerable dependencies, and misconfigured workflows by setting up automated security scanners (CodeQL, Dependabot, Dependency Review, actionlint, and secret scanning) and providing a safe template for environment configurations.

Satisfies: `BR-PROJ-02..03`, `T-13`, `Q-05`, `NFR-OPS-04`.

## What Changes

- Configure a GitHub Actions workflow (`.github/workflows/ci.yml`) to automatically execute `npm run typecheck`, `npm run lint`, `npm run format`, and `npm run test` on push and pull requests targeting the main branch.
- Add GitHub Actions configuration for CodeQL static security analysis.
- Configure Dependabot (`.github/dependabot.yml`) for automated daily dependency update checks.
- Add Dependency Review workflow to block pull requests that introduce vulnerable packages.
- Create a `.github/workflows/actionlint.yml` to lint GitHub workflow configurations.
- Create a `.env.example` template for environment variables showing only names with no real values.

Non-goals:
- Deploying the code to any target environment (e.g. Vercel, Supabase Cloud).
- Setting up the local database emulator (done in R-02).

## Capabilities

### New Capabilities
- `cicd-security-gates`: Establishes the automated continuous integration pipeline and repository-level security policies.

### Modified Capabilities
None.

## Impact

- **CI/CD**: Integrations are automatically verified on GitHub.
- **Repository Health**: Enables automated alerts for dependency updates and security vulnerabilities.
- **Secret Hygiene**: Protects credentials and provides a template configuration via `.env.example`.
