## ADDED Requirements

### Requirement: Local Supabase Stack Initialization
The repository SHALL house local Supabase configuration and setup files (satisfies T-03).

#### Scenario: Verify Supabase project initialization
- **WHEN** the developer views the repository root
- **THEN** a `supabase` directory is present containing `config.toml`

### Requirement: Migrations Workflow
The repository SHALL use versioned SQL migrations to evolve database schema (satisfies T-14).

#### Scenario: Running migration linting
- **WHEN** the developer runs migration checks
- **THEN** the migrations are checked for syntax and structure errors without deploying

### Requirement: Local Development Lifecycle
The repository SHALL provide helper script endpoints to run and stop the local Supabase stack.

#### Scenario: Local helper scripts present
- **WHEN** the developer views package scripts
- **THEN** `supabase:start` and `supabase:stop` commands are available to wrap local emulation commands
