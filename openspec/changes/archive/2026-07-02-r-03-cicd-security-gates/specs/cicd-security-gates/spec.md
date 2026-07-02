## ADDED Requirements

### Requirement: Continuous Integration Pipeline
The repository SHALL use GitHub Actions to verify workspace status on push/PR events (satisfies T-13, Q-05).

#### Scenario: Running verification gates in CI
- **WHEN** a pull request is submitted targeting `main`
- **THEN** GitHub Actions runs typechecking, linting, formatting, and unit tests

### Requirement: Dependency Audits
The repository SHALL check for package updates daily (satisfies Q-05).

#### Scenario: Dependabot check
- **WHEN** GitHub parses the `.github/dependabot.yml` config
- **THEN** daily checks for updates are enabled for npm dependencies

### Requirement: Security Analysis & Secret Hygiene
The repository SHALL provide a public environment template for developers and run automated scanners.

#### Scenario: Safe environment templates
- **WHEN** a developer clones the repository
- **THEN** a `.env.example` file is present containing only keys and zero real secrets
