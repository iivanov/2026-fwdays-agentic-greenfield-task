## Context

To develop and test database-level logic (schemas, tables, constraints, foreign keys, RLS policies, functions, pgmq, pg_cron, secrets) and Deno Edge Functions, we need the local Supabase emulator stack. This ensures development has no production costs and runs in an isolated local environment.

## Goals / Non-Goals

**Goals:**
- Initialize the local Supabase environment in the project.
- Configure `supabase/config.toml` to support the required local features (Auth, Database, Edge Functions).
- Establish the database migration workflow (the first empty migration).
- Add scripts for local dev operations: start, stop, migration validation.

**Non-Goals:**
- Defining schema tables, RLS, or credentials (deferred to R-04).
- Production deployment or provisioning.

## Decisions

- **Supabase Local Stack**: We will use the official Supabase CLI to manage the local Docker-based emulator.
  - *Rationale*: Replicates the cloud backend exactly, including Auth, PG, and Edge Functions (T-03).
- **Migration Engine**: Pure SQL migrations managed by the Supabase CLI (`supabase migration new`).
  - *Rationale*: Keeps schema changes traceable, rollback-capable, and Git-compatible (T-03, T-14).
- **Configuration (config.toml)**: We will customize ports and disable features we don't need locally to keep resource usage minimal.
