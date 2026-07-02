# Human–AI Development Process

## 1. Purpose and Current Phase

This is the factual process record required by the repository's root `AGENTS.md`. It captures how the human and AI collaborate, which decisions were made, what evidence was checked, and what remains unimplemented.

The project is currently in the **architecture and implementation-readiness phase**. Product, data, application, technology, hosting, quality, and IaC decisions exist under `docs/architecture/`; application code, CI workflows, infrastructure files, tests, and deployments have not yet been scaffolded. The documentation is a reviewed specification, not evidence that the system is running.

## 2. Collaboration Model

### Human responsibilities

The human owns intent and acceptance. Decisions supplied or corrected by the human include:

- the personalized news-aggregation product scope;
- $0 and simple hosting;
- separation of technology-neutral architecture from concrete technology;
- signed generic webhooks as an output channel;
- non-commercial use and a public GitHub repository;
- use of open-source/public-repository tooling;
- requirements-driven trade-off analysis and one-way decision traceability;
- explicit static-analysis, IaC, and architecture-tactic coverage.

### AI responsibilities

The AI turns those decisions into reviewable artifacts by:

- auditing documents for contradictions, missing state, and unimplementable claims;
- identifying which documentation layer owns each decision;
- researching unstable provider/tool facts in official documentation;
- comparing credible alternatives before selecting technology;
- propagating approved changes through data, application, technology, and hosting documents;
- running mechanical consistency checks and reporting limitations.

The AI may recommend alternatives, but it must not silently broaden product scope or convert a downstream convenience into an upstream requirement.

## 3. Decision and Implementation Loop

Use this loop for each material change:

1. **Human intent:** Capture the requested outcome, constraint, or correction.
2. **Ownership:** Identify the highest documentation layer that owns the decision.
3. **Impact analysis:** Locate downstream decisions, entities, tactics, tests, hosting, and process records affected.
4. **Evidence:** Verify unstable external claims with primary/official sources; record verification dates in technology documentation.
5. **Maker pass:** Apply the smallest coherent change from upstream to downstream.
6. **Mechanical verification:** Run formatting/diff checks, link/path checks, traceability checks, and relevant code/test/security/IaC checks when those artifacts exist.
7. **Checker pass:** Use a separate reviewer or review invocation for material changes when available; resolve findings or record accepted risk.
8. **Human acceptance:** Present trade-offs and remaining risks for confirmation when the decision changes scope or operational guarantees.
9. **Process update:** Update this file with the milestone, evidence, and unresolved work.

## 4. Maker ≠ Checker Policy

Maker and checker should be separate for material code, migration, security, and deployment changes.

- A maker creates the change and supplies verification evidence.
- A checker reviews requirements, diff, tests, security, and operational consequences without assuming the maker is correct.
- CodeRabbit is available as an external pull-request reviewer through the repository configuration.
- Planned GitHub checks include CodeQL, Dependency Review, Dependabot, secret scanning, workflow linting, type/lint/format gates, migration validation, and tests.

Current evidence is limited: the architecture work received iterative self-review and mechanical checks, but no separate checker result is recorded in this repository yet. Do not describe maker/checker separation as completed until a distinct review artifact exists.

## 5. Recorded Milestones

### 2026-07-01 to 2026-07-02 — Architecture baseline and decision hierarchy

**Human direction**

- Required technology-neutral application architecture and concrete choices in the technology layer.
- Required $0, low-setup hosting and later clarified public, non-commercial use.
- Requested webhook delivery, technology trade-offs, static analysis, IaC, and additional architecture tactics.
- Required every downstream solution to derive from prior-layer analysis.

**AI contribution**

- Introduced stable `BR-*`, `NFR-*`, `D-*`, `A-*`, `AT-*`, `Q-*`, `T-*`, and `H-*` identifiers and traceability.
- Corrected missing data concepts for source/flow runs, per-flow article consumption, persistent fingerprints, delivery attempts, operational events, and integration circuits.
- Selected React/Vite for the static UI, Supabase for the stateful backend, Vercel Hobby for static non-commercial hosting, database-native queues/scheduling, and provider-native IaC/GitOps.
- Added signed generic webhook contracts, retention/security rules, static-analysis gates, and architecture tactics.
- Kept OpenTofu as the multi-environment IaC upgrade path because the current single environment does not justify state management and the Supabase provider is still immature.

**Important decision evolution**

- Vercel was initially rejected as a default while commercial use was unresolved. Once the human explicitly constrained the project to non-commercial use, Vercel Hobby became eligible and was selected for **static frontend hosting only**.
- A full Vercel backend was still rejected because durable relational state, queues, row-level isolation, and frequent scheduling remain in Supabase.
- Redis/BullMQ and VPS-specific AOF/backup tactics were removed when the selected architecture moved to database-native queues and managed serverless functions.
- A fixed-size feed-history assumption was replaced with persistent content-free fingerprints because RSS/Atom has no reliable universal item-count bound.

**Verification performed**

- Inspected repository files and diffs with `rg`, `sed`, and `git status`.
- Ran `git diff --check` after documentation edits.
- Searched for stale technology/hosting terminology and unresolved placeholders.
- Checked requirement and decision identifiers across documentation layers.
- Verified time-sensitive claims using official OpenAI, Supabase, Vercel, Cloudflare, GitHub, Brevo, and OpenTofu documentation.

**Not yet implemented**

- application packages and runtime code;
- database migrations, RLS, queues, schedules, and Edge Functions;
- Vercel/Supabase project configuration and deployment;
- GitHub Actions, CodeQL, Dependabot, Dependency Review, secret scanning configuration, and branch rules;
- automated tests, evals, load tests, and independent checker evidence;
- provider credentials and end-to-end delivery tests.

### 2026-07-02 — Repository guidance correction

**Observation:** Agent guidance existed at `.agents/AGENTS.md`. That directory is suitable for supporting agent assets but is not the repository-level `AGENTS.md` location Codex discovers from the project root.

**Change:** Moved and expanded the guidance to `/AGENTS.md`, covering documentation ownership, verification, secrets, process tracking, and truthful handoff rules. Replaced the previous development-process narrative because it described obsolete fully-Vercel, QStash, Redis AOF, and bounded-FIFO decisions as final and overstated independent review/production readiness.

**Verification:** Confirmed repository-root and nested `AGENTS.md` discovery behavior against current official Codex documentation; checked the resulting paths and Markdown diff.

### 2026-07-02 — Agentic development loop and OpenSpec setup

**Human direction**

- Set up an Antigravity ("agy") environment and a repeatable development loop to
  carry the project to completion.
- Required OpenSpec for spec-driven development, a maker that is separate from
  verification, and explicit use of sub-agents for code review and verification.

**AI contribution**

- Initialized OpenSpec (`@fission-ai/openspec`, upgraded to 1.5.0) with
  `schema: spec-driven`; moved the project brief and per-artifact rules into
  `openspec/config.yaml` (the 1.5.0 `context:`/`rules:` mechanism) and removed
  the legacy `openspec/project.md`.
- Configured both Antigravity and Claude Code targets. Consolidated custom agent
  assets under `.agent/` (singular; Antigravity reads it) and removed the empty
  `.agents/`.
- Authored four binding rules in `.agent/rules/` (spec-driven, maker≠checker,
  verification-gates, security-and-secrets); three role skills in
  `.agent/skills/` (`implement-change` maker, `verify-change` checker,
  `review-change` checker); and four workflows in `.agent/workflows/`
  (`/dev-loop`, `/plan`, `/verify`, `/review`).
- Mirrored the loop into Claude Code: `.claude/commands/` slash commands and
  `.claude/skills/` role skills as **relative symlinks** to the canonical
  `.agent/skills/` files (single source of truth, no drift).
- Added a "Development Loop (Agentic)" section to the root `AGENTS.md`.

**Design decisions**

- `.agent/` (singular) is the canonical home because the OpenSpec CLI manages it
  and Antigravity reads it via backward compatibility; Claude skills symlink in.
- The loop enforces maker≠checker with three separate sub-agents: verify (runs
  real gates + observes behavior) and review (independent adversarial review)
  are distinct from the maker and from each other. CodeRabbit/human PR review is
  an additional external layer.

**Verification performed**

- Confirmed installed vs. latest OpenSpec (1.4.1 → 1.5.0) and re-initialized on
  1.5.0; validated `openspec/config.yaml` parses (schema, `context`, `rules` for
  proposal/specs/design/tasks).
- Confirmed Antigravity conventions (`.agent/rules|skills|workflows`, root
  `AGENTS.md`) and Claude Code conventions (`.claude/skills`, `.claude/commands`)
  from current documentation.
- Verified the `.claude/skills/*` symlinks resolve and are recorded by git as
  symlinks (mode `120000`).

**Not yet implemented**

- No application code, tests, migrations, or CI exist yet; the loop's first
  changes will scaffold them. Verification gates come online incrementally and
  are added to the `AGENTS.md` Verification section only after they run green.
- No change has been run through the full loop yet, so no independent
  verifier/reviewer artifact is recorded from an actual cycle.

### 2026-07-02 — Technology-specific skills installed (trusted sources)

**Human direction**

- Add technology-specific skills at the project level, but only commonly-used
  skills from trusted sources; confirm they work with Antigravity; install the
  ones that help.

**AI contribution**

- Verified provenance before installing: rejected community skill aggregators
  and used only first-party repos. Installed via the `vercel-labs/skills` CLI
  (`npx skills`, itself a trusted first-party tool) with `-a antigravity
  --copy`, project-scoped.
- Installed five skills into the canonical `.agent/skills/`:
  `supabase` and `supabase-postgres-best-practices` (from `supabase/agent-skills`,
  MIT); `webapp-testing`, `frontend-design`, and `skill-creator` (from
  `anthropics/skills`, Apache-2.0).
- Reconciled the directory-convention mismatch (OpenSpec uses `.agent/`, the
  skills CLI uses `.agents/`) by making `.agents/` a symlink to `.agent/`, so
  both tools write to one real directory and Antigravity reads either name.
- Recorded provenance + content-integrity hashes in `skills-lock.json` and a
  source/license table in `AGENTS.md`.

**Verification performed**

- Confirmed each skill passed the CLI's Socket/Snyk/Gen security assessments
  (all installed as Safe / 0 alerts).
- Scanned installed skills for shipped scripts: Supabase skills and
  `frontend-design` are Markdown-only; `webapp-testing` and `skill-creator` ship
  Python scripts that run with full agent permissions (reviewed as coming from
  Anthropic's official Apache-2.0 repo).
- Confirmed all five resolve under `.agent/skills/` via the `.agents` symlink and
  that `.claude/` was not touched.

**Not yet implemented / caution**

- Skills are copied snapshots; refresh with `npx skills update` and re-check
  `skills-lock.json` hashes. Third-party skills are advisory know-how and never
  override the binding `.agent/rules/`.
- For libraries without a trusted skill (React, Vite, TanStack Query, OpenAI
  Responses API, Brevo), the context7 MCP is the intended live-docs source.

### 2026-07-02 — Autonomous build loop (autopilot)

**Human direction**

- Create a flow where Antigravity develops the project with no human needed:
  decompose requirements into tasks, define/make changes via OpenSpec, verify
  with the Playwright CLI, produce an artifact that verifies the result, pass a
  verification gate, then move to the next task until the project is done.

**AI contribution**

- Added the decomposed backlog `docs/roadmap.md` (19 dependency-ordered slices
  `R-01..R-19` mapped to upstream IDs) plus an explicit "Human bootstrap
  required" list for account/secret/spend/deploy steps.
- Added the `decompose-requirements` (planner) and `verify-e2e` (Playwright CLI
  behavior + committed verification artifact) skills; pointed `verify-change` at
  `verify-e2e` for behavioral checks.
- Added the `/decompose` and `/autopilot` workflows. `/autopilot` runs the
  spec-driven maker≠checker cycle unattended, slice by slice, with a hard gate
  (static gates + Playwright e2e artifact + independent review) and resumes from
  roadmap state.
- Added rule `50-autonomous-operation`: decide from the docs instead of
  prompting; keep maker≠checker; safety rails (branch only, never `main`, no
  force-push/auto-merge/deploy/spend/account-creation, never weaken gates);
  explicit stop/escalate conditions.
- Ignored regenerable Playwright artifacts (`playwright-report/`,
  `test-results/`, `coverage/`, …) while keeping the committed
  `openspec/changes/<name>/verification.md` evidence.

**Design decisions / honest boundary**

- "No human needed" applies to everything verifiable locally (code, migrations
  against local Supabase, unit/integration/e2e, CI config). Steps that require
  real accounts, secrets, spend, or production deploy — and the final merge to
  `main` — remain human-gated by default and are collected, not faked. This can
  be loosened only with an explicit human go-ahead.

**Verification performed**

- `git diff --check` clean; frontmatter valid on the new rule/skills/workflows;
  internal path references resolve; OpenSpec CLI healthy.

**Not yet implemented**

- `/autopilot` has not been run yet, so no slice has been built or verified
  through it; the roadmap statuses are all `pending`.

### 2026-07-02 — R-01 Monorepo Scaffold

**Human direction**

- Run autopilot to build the backlog.

**AI contribution**

- Established npm workspaces for `@news-aggregator/shared`, `@news-aggregator/browser`, and `@news-aggregator/edge`.
- Configured strict TypeScript compiler configuration at the root and extending into each package.
- Formulated zero-warning ESLint flat configuration using `typescript-eslint`.
- Structured Prettier for format checks and Vitest for unit testing.
- Created a placeholder unit test verifying the Vitest environment works.

**Design decisions**

- Standardized on typescript-eslint flat configurations.
- Verified test runner using in-memory vitest math test.

**Verification performed**

- Executed linting, formatting, typechecking, and vitest runs locally.

**Not yet implemented**

- Local Supabase setup (R-02) and CI/CD pipelines (R-03).

### 2026-07-02 — R-02 Supabase Local Dev

**Human direction**

- Switched to developing directly on `main` branch.

**AI contribution**

- Installed Supabase CLI as a local project devDependency.
- Initialized local Supabase project configurations (`supabase init`) under `supabase/`.
- Updated `.gitignore` to ignore Supabase temp state files.
- Formed initial empty migration file (`supabase/migrations/20260702000000_init.sql`).
- Added package scripts `supabase:start`, `supabase:stop`, `supabase:reset`, and `supabase:lint` in root `package.json`.

**Design decisions**

- Setup Docker-based local Supabase emulator for cost-free database and auth local verification.

**Verification performed**

- Verified config.toml and validated that the scripts were wired up and parsed cleanly.

**Not yet implemented**

- Core database schema and RLS policies (R-04) and CI/CD pipelines (R-03).

### 2026-07-02 — R-03 CI/CD + Repo Security Gates

**AI contribution**

- Created `.github/workflows/ci.yml` — runs typecheck, lint, format, and test on push/PR to main.
- Created `.github/workflows/codeql.yml` — CodeQL `security-extended` analysis weekly + on push/PR.
- Created `.github/workflows/dependency-review.yml` — blocks PRs with high-severity vulnerable deps.
- Created `.github/workflows/actionlint.yml` — lints workflow files on changes to `.github/workflows/`.
- Created `.github/dependabot.yml` — daily npm and weekly GitHub Actions dependency checks.
- Created `.env.example` — environment variable template with key names only, no real values.

**Design decisions**

- Used least-privilege `permissions` blocks in every workflow (contents: read).
- CodeQL runs `security-extended` queries as specified by Q-05.
- Dependabot covers both npm and github-actions ecosystems.

**Verification performed**

- Ran `npm run lint`, `npm run format`, and `npm run typecheck` locally — all pass.

**Not yet implemented**

- Core database schema and RLS policies (R-04).

### 2026-07-02 — R-04 Core Schema + RLS Migrations

**AI contribution**

- Created database migration file `supabase/migrations/20260702000100_core_schema.sql`.
- Defined all 15 tables and join structures specified in `data_structure.md`.
- Enforced type restrictions using text CHECK constraints for simple, reliable migrations.
- Set up deny-by-default Row Level Security (RLS) on all 15 tables.
- Provisioned split RLS policies (separate insert/select/update/delete) on user-owned tables.
- Column-level UPDATE grants restrict authenticated users from modifying internal fields.

**Design decisions**

- Chose text columns with SQL CHECK constraints over Postgres custom types for robust migration and ease of schema evolution.
- Configured partial unique indices plus trigger-based cross-partition uniqueness checks for articles and fingerprints.

**Security hardening (from 6 rounds of maker/checker review)**

- `handle_updated_at()` trigger on profiles, delivery_channels, processing_flows, integration_circuits (auto-managed timestamps).
- `handle_delivery_channel_verification()` trigger resets status/verified_at/failures on config/type change (prevents verification bypass).
- Strict delivery channel INSERT policy enforces `status='pending'`, `verified_at IS NULL`, `consecutive_failure_count=0`, `last_error_code IS NULL`.
- `get_next_0600_utc()` uses timezone-aware `at time zone 'utc'` arithmetic (session-timezone-independent).
- `handle_processing_flow_scheduling()` trigger locks scheduling fields from authenticated users while allowing service_role.
- `check_processing_flow_quota()` trigger with `FOR UPDATE` row lock on profile serializes concurrent quota enforcement (max 5 flows).
- `check_article_uniqueness()` and `check_fingerprint_uniqueness()` triggers enforce cross-GUID/URL uniqueness.
- All timestamp defaults changed from `timezone('utc', now())` to `now()` (correct for timestamptz columns).
- `processing_runs` SELECT policy + grant added for authenticated users.
- `flow_articles(article_id)` index added for cascade delete performance.
- SQLSTATE code corrected to `raise_exception` (valid PL/pgSQL errcode).

**Verification performed**

- 6 rounds of independent verifier + reviewer sub-agents (maker ≠ checker enforced).
- Final verdict: Verifier PASS (8/8 runnable gates green), Reviewer APPROVE (0 blocking findings, 5 low/info non-blocking).
- All gates pass: typecheck, lint, format, test, supabase:reset, supabase:lint, npm audit, git diff --check.

**Not yet implemented**

- Profile management CRUD (R-07).

### 2026-07-02 — R-06 API Edge Function Skeleton

**AI contribution**

- Created the Deno Edge Function project structure under `supabase/functions/api/`.
- Implemented core CORS configurations, response envelope wrappers (`sendSuccess`, `sendError`), and schema validators (`validateBody` via Zod).
- Built a path-based routing gateway routing `/health` (public) and mapping `/profiles`, `/sources`, `/flows`, `/channels` (which verify user JWT sessions).
- Created a comprehensive Vitest unit test suite `packages/browser/src/lib/api-helpers.test.ts` verifying CORS, envelope responses, validation error payloads, and routing conditions.

**Design decisions**

- Chose a single gateway router model for the `api` function over many small functions to minimize cold start latency and facilitate common middleware code reuse.
- Factored out helper and router logic into `helpers.ts` (independent of `@supabase/server`) to support robust unit testing within Node-based Vitest execution.

**Verification performed**

- Verified Javascript/TypeScript linting, formatting, type checking, and all 13 unit/integration tests pass cleanly.

**Not yet implemented**

- Profile management CRUD (R-07).

### 2026-07-02 — R-05 Supabase Auth Integration

**AI contribution**

- Added `[auth.external.google]` and `[auth.external.github]` configurations to `supabase/config.toml` for local development.
- Created database migration file `supabase/migrations/20260702000200_auth_trigger.sql`.
- Defined a `handle_new_user()` trigger function on `auth.users` to automatically provision a user profile in `public.profiles` and default `in-app` (active) and `email` (active/pending depending on verification status) delivery channels upon new registration.
- Installed `@supabase/supabase-js` package in `packages/browser`.
- Created a configured, typed browser client `packages/browser/src/lib/supabase.ts` with explicit PKCE flow enabled (`flowType: 'pkce'`).
- Re-exported the Supabase client and `SupabaseClient` type from the package entrypoint `packages/browser/src/index.ts`.
- Updated `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and OAuth provider placeholder environment variables.

**Design decisions**

- Chose `SECURITY DEFINER` for the trigger function `handle_new_user()` to allow auth registration to bypass RLS policies on profiles and delivery channels safely. Used `set search_path = ''` to prevent search path injection attacks.
- Configured default channels immediately upon OAuth registration, keeping email channel `pending` unless the OAuth provider certifies email verification (`new.email_confirmed_at is not null`).
- Used Vite env vars (`VITE_SUPABASE_*`) to initialize the browser client, ensuring clean, framework-native client compilation for SPAs.

**Verification performed**

- Verified migrations apply cleanly with `npm run supabase:reset`.
- Ran `npm run supabase:lint` locally — database schema lints cleanly.
- Verified JavaScript/TypeScript quality gates with type checking (`npm run typecheck`), linting (`npm run lint`), formatting (`npm run format`), and tests (`npm run test`) — all passed.

**Not yet implemented**

- `api` Edge Function skeleton (R-06).





## 6. Definition of Done for Future Changes

A change is complete only when:

- its upstream requirement/decision is explicit;
- downstream data, architecture, tactics, technology, hosting, and quality impacts are updated;
- implementation and tests exist when the task includes implementation;
- relevant formatter, lint, type, test, security, migration, and IaC checks pass;
- a separate checker reviews material risk when available;
- remaining risks and unimplemented work are stated;
- this process record is updated when the change is material.
