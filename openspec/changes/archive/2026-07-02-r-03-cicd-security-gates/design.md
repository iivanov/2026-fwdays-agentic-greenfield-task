## Context

To automatically verify quality gates (type checking, linting, formatting, tests) and prevent introducing vulnerabilities/secrets, we need to set up GitHub Actions workflows and configuration files.

## Goals / Non-Goals

**Goals:**
- Configure automatic integration tests (CI) running on every push and PR.
- Enable Dependabot dependency auditing.
- Set up CodeQL security analysis.
- Set up actionlint to validate our workflow actions configuration.
- Add `.env.example` template.

**Non-Goals:**
- Setting up CD or deployments (Vercel, Supabase).
- Local emulator stack configurations (done in R-02).

## Decisions

- **CI Engine**: GitHub Actions.
  - *Rationale*: Free, integrated with the repository, robust ecosystem (T-13, Q-05).
- **Vulnerability Check**: CodeQL & Dependency Review.
  - *Rationale*: Native GitHub capabilities that verify code quality and supply chain security automatically.
- **Workflow Linting**: actionlint.
  - *Rationale*: Prevents syntax/execution mistakes in GitHub workflow files.
- **Dependency Automation**: Dependabot.
  - *Rationale*: Native automation for package.json audits.
