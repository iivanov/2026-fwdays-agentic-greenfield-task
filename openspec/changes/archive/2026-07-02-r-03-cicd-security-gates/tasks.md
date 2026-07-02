## 1. CI Workflows

- [x] 1.1 Create the primary GitHub Actions workflow `.github/workflows/ci.yml` running typecheck, lint, format, and test.
- [x] 1.2 Create the actionlint workflow `.github/workflows/actionlint.yml` to lint all workflows.

## 2. Security Workflows & Configs

- [x] 2.1 Create the CodeQL workflow `.github/workflows/codeql.yml` for automated static security analysis.
- [x] 2.2 Create the Dependency Review workflow `.github/workflows/dependency-review.yml` for pull request vulnerability checks.
- [x] 2.3 Create the Dependabot configuration `.github/dependabot.yml` targeting npm dependencies.

## 3. Configuration Templates

- [x] 3.1 Create `.env.example` showing only keys and no actual values.

## 4. Documentation & Verification

- [x] 4.1 Update `docs/development_process.md` with the milestone for CI/CD and security setup.
- [x] 4.2 Run `npm run lint` and `npm run format` locally to verify changes.

## 5. Review & Archive

- [x] 5.1 Spawn the `verify-change` sub-agent to verify that all workflows and configuration files are correct.
- [x] 5.2 Spawn the `review-change` sub-agent to review the workflow configurations.
- [x] 5.3 Once both checkers pass, archive the change.
