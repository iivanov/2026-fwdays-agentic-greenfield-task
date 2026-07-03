## 1. RLS migration

- [x] 1.1 Add a Supabase migration that drops broad authenticated `SELECT` policies for `global_sources` and `ingested_articles`.
- [x] 1.2 Add replacement `SELECT` policies scoped through owned `flow_sources` and `flow_articles` links.

## 2. Tests and specs

- [x] 2.1 Add automated tests that assert the R-11E migration has no broad authenticated shared-data policy and contains owner-link predicates.
- [x] 2.2 Sync the canonical `core-schema-rls` OpenSpec with shared source/article visibility requirements.

## 3. Handoff

- [x] 3.1 Update `docs/state.md`, `docs/roadmap.md`, and `docs/development_process.md`.
- [x] 3.2 Run applicable gates and retain independent verifier/reviewer reports before archive.
