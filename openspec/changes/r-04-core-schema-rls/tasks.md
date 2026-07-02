## 1. Schema Migrations

- [x] 1.1 Create the migration SQL file `supabase/migrations/20260702000100_core_schema.sql` defining all structural tables, columns, foreign keys, and indexes.
- [x] 1.2 Add custom enumerations (`delivery_channel_type`, `delivery_channel_status`, `global_source_status`, `global_source_type`, `flow_run_status`, `flow_article_status`, `feedback_type`, `attempt_status`, `operational_event_severity`, `circuit_scope`, `circuit_state`).

## 2. Row Level Security (RLS)

- [x] 2.1 Enable Row Level Security on all tables.
- [x] 2.2 Create RLS policies for user-owned tables restricting access to `auth.uid() = user_id` for select, insert, update, delete operations.
- [x] 2.3 Create minimal read policies for shared data access (e.g. global sources, ingested articles).

## 3. Documentation & Verification

- [x] 3.1 Update `docs/development_process.md` with the milestone for core database schema and RLS policies setup.
- [x] 3.2 Run local database reset (`npm run supabase:reset`) and linting (`npm run supabase:lint`) to verify the migration correctness.
- [x] 3.3 Run `npm run lint` and `npm run format` locally.

## 4. Review & Archive

- [x] 4.1 Spawn the `verify-change` sub-agent to verify that the migration applies cleanly and all gates pass.
- [x] 4.2 Spawn the `review-change` sub-agent to review RLS policy correctness and schema alignments.
- [x] 4.3 Once both checkers pass, archive the change.
