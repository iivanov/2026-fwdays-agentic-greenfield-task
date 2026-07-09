# Human–AI Development Process

## 1. Purpose and Current Phase

This is the factual process record required by the repository's root `AGENTS.md`. It captures how the human and AI collaborate, which decisions were made, what evidence was checked, and what remains unimplemented.

The project is in the **implementation audit and remediation phase**. Product,
data, application, technology, hosting, quality, and IaC decisions exist under
`docs/architecture/`; R-01..R-11 produced application code, migrations, local
infrastructure, CI configuration, and tests. Independent audit findings in
`docs/state.md` and `docs/roadmap.md` must be resolved before those commits can
be treated as a verified release. No production deployment is evidenced.

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
7. **Checker passes:** Separate verifier and reviewer agents check the final
   material diff; resolve blocking findings and rerun both after maker fixes.
8. **Human acceptance:** Present trade-offs and remaining risks for confirmation when the decision changes scope or operational guarantees.
9. **Process update:** Update this file with the milestone, evidence, and unresolved work.

## 4. Maker ≠ Checker Policy

Maker, verifier, and reviewer MUST be separate agents for every material
change, including code, migration, security, deployment, and cross-cutting
governance changes.

- A maker creates the change and supplies verification evidence.
- A checker reviews requirements, diff, tests, security, and operational consequences without assuming the maker is correct.
- CodeRabbit is available as an external pull-request reviewer through the repository configuration.
- Repository workflows configure CodeQL, Dependency Review, and npm quality
  gates, and Dependabot configuration exists. Hosted results, branch protection,
  secret scanning/push protection, Deno checks, Playwright, and complete
  migration enforcement remain unverified or missing as recorded in R-11B.

Current evidence is limited: R-01..R-11 archives contain no durable checker
reports even where milestone text claims independent rounds. R-11A is the first
change required to retain separate verifier and reviewer artifacts; do not use
earlier prose claims as certification evidence.

## 5. Recorded Milestones

### 2026-07-03 — R-11B verification-gates WIP checkpoint

**Human direction**

- Requested committing and pushing the current work before R-11B independent
  verification/review was complete.

**AI contribution**

- Created the R-11B OpenSpec change for real Deno, Playwright, coverage,
  integration-prerequisite, and CI gates.
- Added partial implementation for root gate scripts, Deno lock/config,
  Playwright smoke harness, Vitest coverage, split Supabase integration tests,
  explicit integration prerequisite failures, CI expansion, and runnable-gate
  documentation.

**Verification performed**

- `openspec validate r-11b-enforce-real-verification-gates --strict` passed.
- `npm run test`, `npm run test:coverage`, `npm run typecheck`, and
  `npm run build:browser` passed.
- Deno lock generation succeeded with public registry access.

**Not complete**

- R-11B is not archived and has no independent verifier/reviewer artifacts.
- Final lint/format/Deno/e2e/integration gates still require cleanup and rerun
  on a clean R-11B diff because the live workspace also contains paused R-12
  draft files.

### 2026-07-03 — R-11B CI repair checkpoint

**Human direction**

- Continue development directly on `main`; no feature branches are needed for
  this single-developer repository.

**AI contribution**

- Added the main-only working policy to `AGENTS.md`.
- Fixed the actionlint workflow by replacing the stale pinned installer script
  URL with a direct pinned `actionlint` release tarball download.
- Fixed Deno Web Crypto typing in `supabase/functions/api/crypto.ts` by passing
  `ArrayBuffer` values to `crypto.subtle.encrypt/decrypt`.
- Made the browser smoke test deterministic by building the Vite app with
  non-secret local Supabase placeholder env values and asserting the
  unauthenticated login shell.
- Resolved the Deno/Prettier formatter ownership conflict by letting Deno own
  `supabase/functions` formatting and excluding that tree from Prettier.

**Verification performed**

- `actionlint .github/workflows/actionlint.yml .github/workflows/ci.yml`
  passed.
- `npm run verify:local` passed: typecheck, lint, format, unit tests, coverage,
  Deno check/lint/fmt/lock, npm audit, browser build, and Playwright smoke e2e.
- `npm run deno:outdated` exited 0, with a non-blocking warning that some update
  metadata could not be fetched.

**Not complete**

- R-11B still needs local Supabase integration/migration-lint evidence and
  separate verifier/reviewer artifacts before archive.

### 2026-07-03 — R-11B Supabase integration CI diagnostics

**AI contribution**

- Updated Supabase integration tests to use shared local Supabase connection
  settings from `SUPABASE_URL`/`API_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`/`SERVICE_ROLE_KEY`/`SECRET_KEY`, with the legacy
  local service-role JWT only as a fallback.
- Replaced a single health probe with a 60-second Auth health wait.
- Removed broad `catch` blocks that hid Supabase auth/admin/API setup failures
  behind a generic “DB not running” message.
- Updated CI to export `npx supabase status -o env` values after database reset
  and to use Node 22, matching current `@supabase/supabase-js` support guidance.

**Verification performed**

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npm run test` passed: 5 files, 67 tests.
- `actionlint .github/workflows/actionlint.yml .github/workflows/ci.yml`
  passed.
- `git diff --check` passed.
- `npm run test:integration` failed locally because this sandbox cannot connect
  to `127.0.0.1:54321` (`connect EPERM`); this is recorded as blocked local
  integration evidence, not as a product pass.
- The first pushed CI run for this patch passed through Playwright smoke and was
  then cancelled by the follow-up timeout commit while in `Start Supabase`.
- The workflow now has a 25-minute job timeout plus bounded Supabase
  start/reset/status/lint/test/stop step timeouts so CI cannot hang silently.
- GitHub CI run `28681035556` for final R-11B documentation commit `f1d7354`
  passed all quality gates, including Supabase start/reset/status export,
  migration lint, integration tests, and cleanup; it supersedes earlier run
  `28679753122` for `a66230e`.
- Follow-up review found that `deno outdated --compatible` is an update check,
  not a security advisory scanner, so the Deno gate was renamed to
  `deno:outdated` and the CI/spec/docs terminology was corrected.

**Closure**

- R-11B retained independent verifier PASS and independent reviewer APPROVE reports, synced the `cicd-security-gates` spec, archived the change as `openspec/changes/archive/2026-07-03-r-11b-enforce-real-verification-gates/`, and marked R-11B done in the roadmap. R-11C is the next slice; R-11C was not started in this stage.

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

### 2026-07-02 — R-07 Profile Management CRUD

**AI contribution**

- Implemented GET and PUT `/profiles` endpoints inside the API router gateway.
- Built ProfilePanel dashboard tab styling with Outfit typography and HSL slate dark themes.
- Configured user preference keyword tags and language selections query states using React Query.

**Design decisions**

- Used React SPA setup with Outfit fonts and custom HSL palettes.

**Verification performed**

- Passed lints, TypeScript type checks, and Vitest runs cleanly.

### 2026-07-02 — R-08 Source Management

**AI contribution**

- Implemented standard-compliant, segment-based IPv6 address parser and normalized validation checkers.
- Extended SSRF matrix checks to NAT64, 6to4, IPv4-Compatible, IPv4-Translated, unique-local, link-local, multicast, and loopback address blocks.
- Added API routes for GET, POST, and DELETE `/sources` verifying flow ownership.
- Built interactive dashboard navigation tabs switching between Preferences and Ingestion Sources settings.
- Configured auto-scaffolding of default daily flows to prevent empty panel blocks in UX.
- Updated DELETE /sources to execute `.select()` and throw clean `404` errors when disconnecting non-existent or unauthorized links.

**Design decisions**

- Chose DnsResolver callbacks on edge functions to decouple testing logic from Deno globals and support Node.js test mocking.
- Bypassed RLS on POST /sources to resolve global unique records via service role supabaseAdmin, while retaining RLS user checks on flow ownership and linkages.

**Verification performed**

- 2 rounds of independent Verifier + Reviewer checkers (maker != checker).
- Expanded ssrf.test.ts test matrix validating all translation bypass vectors.
- All 42 tests passed, ESLint clean, and production client compiles correctly.

**Not yet implemented**

- Flow management settings panel (R-09) and delivery channels (R-10).

### 2026-07-03 — R-09 Flow Management CRUD

**AI contribution**

- Implemented GET, POST, PUT, DELETE `/flows` REST endpoints inside the Deno edge helper router.
- Supported route path segment parameter parsing to cleanly extract target resource UUIDs (e.g. `/flows/:id`).
- Handled Postgres database trigger quota check exceptions, mapping them safely to `400 Bad Request` at the API boundaries.
- Created `FlowsPanel.tsx` in React to manage channel settings, toggle active status, configure custom prompts, and visually surface quota limit warnings.
- Linked the Flows tab to the dashboard layout in `App.tsx`.
- Corrected database query column name selection inside `SourcesPanel.tsx` (migrated from `enabled` to `is_enabled`).
- Added robust validation tests in `api-helpers.test.ts` ensuring bad parameters, bad schemas, and quota exhausts fail closed with 400/404s.

**Design decisions**

- Leveraged standard Deno path segment parameters for update/delete actions.
- Relied on user-bound JWT contexts (`supabaseClient`) to verify flow ownership at RLS database layer.

**Verification performed**

- 2 rounds of independent Verifier + Reviewer checkers (maker != checker).
- All 52 Vitest tests pass cleanly. Lints, TypeScript compiler, and Vite builds are 100% green.

**Not yet implemented**

- Delivery channels CRUD (R-10) and Daily scheduler edge function trigger (R-11).

### 2026-07-03 — R-10 Delivery Channels Configuration

**AI contribution**

- Implemented GET, POST, PUT, DELETE, and POST verify endpoints for `/channels` in Deno edge helper router.
- Supported mapping, linking, and unlinking channels to processing flows via `/flows/:id/channels` routing paths.
- Built AES-256-GCM configurations encryption/decryption module using standard Web Crypto API globally compatible across Node.js/Deno.
- Added credential masking filters hiding sensitive target details (tokens, secrets, URLs) on read APIs before responding to client interfaces.
- Enforced generic webhooks SSRF resolution checks matching segment-based safety rules.
- Cryptographically generated per-channel HMAC-SHA256 signing secret keys for webhook delivery targets.
- Created `DeliveryPanel.tsx` React view supporting connection forms, toggle maps, active status verification, and deletion flows.
- Connected the Delivery tab navigation controls to the dashboard layout.
- Wrote unit tests in `crypto.test.ts` verifying AES symmetric loops, tampered cipher block decryptions, and masking results.
- Added integration tests in `api-helpers.test.ts` verifying endpoints.

**Design decisions**

- Leveraged standard Web Crypto `crypto.subtle` APIs to keep core packages self-contained and run unit tests natively in Node without Node crypto polyfills.
- Ensured `getMasterKey()` fails closed by throwing an Error if no master key is supplied in production, while permitting fallback Vitest keys for local tests.

**Verification performed**

- 2 rounds of independent Verifier + Reviewer checkers (maker != checker).
- All 69 Vitest tests pass cleanly. Format, lints, TS compilation, Vite production build, and database schema are green.

**Not yet implemented**

### 2026-07-03 — R-11 Queue and Scheduler Infrastructure

**AI contribution**
- Created database migration file `supabase/migrations/20260703000000_scheduler_queue.sql` configuring `pgmq` message queues (`ingestion-queue`, `processing-queue`, `delivery-queue`) and `pg_cron` jobs.
- Implemented edge functions under `supabase/functions/`:
  - `schedule-daily`: scans active processing flows, registers run cycles, and enqueues ingestion jobs.
  - `work`: consumes claimed queue messages, processes task stub skeletons, handles DLQ limits (5 failures), and writes failure logs to `operational_events`.
  - `cleanup`: reclaims expired visibility leases and prunes database records older than 7 days.
- Revoked execution privileges on all 8 RPC helper functions from `public` role and granted exclusively to `postgres` and `service_role`.
- Secured edge handlers by failing closed when `SUPABASE_SERVICE_ROLE_KEY` is missing or empty.
- Configured local pg_cron tasks to route requests through internal container URL `http://kong:8000/functions/v1/`.
- Created integration tests in `packages/browser/src/lib/queue-runner.test.ts` verifying scheduling execution, worker drain, DLQ transitions, and database cleanups.

**Design decisions**
- Used database-native PGMQ queues and pg_cron scheduling to fit Supabase free tier parameters.
- Overwrote expired scheduling targets with database updates bypass logic on trigger handlers to support fast local developer verification loops.
- Asserted `reclaimed_delivery_runs` from `digest_delivery_attempts` table prunes inside cleanup operations.

**Verification performed**
- 3 rounds of independent Verifier + Reviewer checks (maker != checker).
- All 70 Vitest tests pass cleanly. Lints, Prettier formatting style, and TypeScript compiler are 100% green.

## 6. Definition of Done for Future Changes

A change is complete only when:

- its upstream requirement/decision is explicit;
- downstream data, architecture, tactics, technology, hosting, and quality impacts are updated;
- implementation and tests exist when the task includes implementation;
- relevant formatter, lint, type, test, security, migration, and IaC checks pass;
- separate verifier and reviewer agents retain their final reports and have no
  unresolved blocking findings;
- remaining risks and unimplemented work are stated;
- this process record is updated when the change is material.

### 2026-07-03 — Independent implementation audit and autonomous-loop recovery

**Human direction**

- Verify and audit the Antigravity implementation, repair findings, add missing
  OpenSpecs, and continue autonomously to completion with a commit per stage.

**Independent evidence**

- A verifier ran the committed baseline separately from the implementation
  agent: npm typecheck/lint/format/test, browser build, actionlint, npm audit,
  strict OpenSpec validation, local database lint, and the R-11 Supabase
  integration scenario. Existing committed code gates were green, while the
  active R-12 snapshot failed lint, format, and dependency resolution.
- A separate reviewer audited requirements, schema, RLS, API/worker code, active
  R-12, and archived artifacts. It reported blocking prompt-encryption,
  delivery-identity, shared-data authorization, queue-acknowledgement,
  retention, DNS-rebinding, and ingestion defects.
- Evidence audit found 0 verifier/reviewer artifacts across 11 archived changes,
  unchecked R-11 tasks, placeholder canonical spec purposes, no Deno gate, no
  Playwright harness, and integration tests that can silently avoid execution.

**Changes in this stage**

- Canonicalized `docs/ROADMAP.md` to `docs/roadmap.md` so case-sensitive
  autonomous workflows can locate it.
- Added R-11A..R-11I remediation slices plus missing R-20 browser-auth coverage.
- Replaced optimistic state claims with observed evidence and preserved the
  uncommitted R-12 maker output for later repair.
- Added OpenSpec change `audit-state-and-verification-evidence` defining
  truthful completion state and durable checker evidence.

**Unresolved work**

- R-11B..R-11I and R-12..R-20 remain planned, not implemented or certified.
- Hosted GitHub controls, accounts, secrets, paid OpenAI use, and deployment
  remain human-bootstrap items and are not claimed as verified.

**R-11A verification and review**

- Attempt 1 failed on two governance contradictions: conditional checker
  language and unconditional Playwright for documentation-only changes.
- The maker aligned root guidance, autonomous-operation rule, autopilot skill,
  and workflow. Attempt 2 passed the substantive diff. Later administrative
  status updates are tracked by subsequent checker attempts in the durable
  reports retained with the OpenSpec change.


### 2026-07-03 — R-11C custom prompt encryption archived

**AI contribution**

- Proposed, implemented, verified, reviewed, and archived `r-11c-encrypt-custom-prompts`.
- Added shared prompt encryption/decryption helpers, encrypted custom prompt storage in the flow API, owner-filtered service-role read/update paths, direct Data API column restrictions for `prompt_template`, local/dev plaintext prompt nulling for this no-production greenfield repo, and no-leak persistence-error coverage.

**Verification performed**

- Independent verifier PASS retained in the archived OpenSpec change.
- Independent reviewer APPROVE retained in the archived OpenSpec change after the reviewer-requested fixes.
- Local gates passed: `npm run typecheck`, `npm run lint`, `npm run deno:check`, `npm run deno:fmt`, `npm run test`, `npx -y @fission-ai/openspec@1.5.0 validate r-11c-encrypt-custom-prompts --strict`, and `git diff --check`.

**Closure**

- R-11C is marked done in `docs/roadmap.md`; R-11D is the next remediation slice.


### 2026-07-03 — R-11D delivery identity/secrets maker implementation

**Human direction**

- Continue implementation according to the autonomous roadmap plan.

**AI contribution**

- Selected R-11D as the next pending remediation slice after archived R-11C.
- Created the R-11D OpenSpec change and implemented delivery identity/secret repairs in the Edge API and browser delivery panel.
- Added unit coverage for verified email binding, Telegram bot-token rejection, webhook one-time secret exposure, and fail-closed webhook verification.

**Verification performed by maker**

- `npm run typecheck` passed.
- `npm run test -- packages/browser/src/lib/api-helpers.test.ts` passed.

**Not complete**

- Independent verifier PASS and reviewer APPROVE disposition are retained in the R-11D change artifacts.
- No production provider credentials or external Telegram/Slack/webhook accounts were created or used.


### 2026-07-03 — R-11D closure

**Closure**

- R-11D retained independent verifier PASS and independent reviewer APPROVE reports.
- Synchronized the delivery-channel OpenSpec with verified email binding, app-owned Telegram bot configuration, functional channel verification, and one-time/preserved webhook signing-secret behavior.
- Archived the change as `openspec/changes/archive/2026-07-03-r-11d-repair-delivery-identity-secrets/` and marked R-11D done in the roadmap. R-11E is the next remediation slice.


### 2026-07-03 — R-11E shared source/article RLS maker implementation

**Human direction**

- Continue autonomous implementation through Phase 4.

**AI contribution**

- Selected R-11E as the next pending remediation slice after archived R-11D.
- Created the R-11E OpenSpec change.
- Added a Supabase migration replacing broad authenticated shared-source/article read policies with owned-flow-link policies.
- Added Vitest policy-shape coverage and synced the canonical core schema/RLS spec.

**Verification performed by maker**

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npm run test -- packages/browser/src/lib/rls-policy.test.ts` passed: 1 file, 3 tests.
- `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` passed.
- `git diff --check` passed as part of the combined gate.
- `npm run supabase:lint` failed locally because the Supabase database was not reachable (`LegacyDbConnectError`); this is recorded as not-run integration evidence, not a product pass.

**Not complete**

- Independent verifier PASS and reviewer APPROVE reports are retained in the R-11E change artifacts.


### 2026-07-03 — R-11E closure

**Closure**

- R-11E retained independent verifier PASS and independent reviewer APPROVE reports.
- Synchronized the `core-schema-rls` spec with shared source/article visibility through owned flow links.
- Archived the change as `openspec/changes/archive/2026-07-03-r-11e-restrict-shared-source-article-rls/` and marked R-11E done in the roadmap. R-11F is the next remediation slice.

### 2026-07-03 — R-11F queue acknowledgement maker checkpoint

**AI contribution**

- Created the R-11F OpenSpec change for queue transactional acknowledgement repair.
- Added PostgreSQL RPCs for transactional worker completion, worker failure state recording, queue name validation, and exhausted-message archive plus operational-event logging.
- Updated the `work` Edge Function so claim errors fail closed, success acknowledgement goes through the transactional RPC, exhausted retries are archived before job execution, and delivery attempts use schema-correct `sending`/`delivered`/`failed` states with `error_message`.
- Added focused Vitest coverage for delivery state names, transactional completion RPC usage, claim RPC failure, and DLQ ordering.

**Verification performed**

- `npm run typecheck` passed.
- `npm run test -- packages/browser/src/lib/queue-worker.test.ts` passed: 1 file, 3 tests.

**Not complete**

- R-11F retained an independent reviewer APPROVE report and an independent verifier report that passed static/unit/build gates but warned that local Supabase/Postgres was unavailable for migration lint and integration tests.
- R-11F is not archived until Supabase-backed gates pass in a suitable environment. Later roadmap slices through Phase 4 remain pending; this checkpoint intentionally avoids claiming production readiness.

### 2026-07-04 — R-11F closure

**Human direction**

- Before continuing roadmap implementation, fix or resolve the verifier warnings for `npm run supabase:lint`, `npm run test:integration`, and `npx openspec show r-11f-repair-queue-ack`.

**AI contribution**

- Confirmed the local Supabase container stack was running but needed a fresh migration replay; ran `npm run supabase:reset`.
- Reproduced the integration failure after the first reset as a real stale-schema/worker issue, then cleaned the scheduler migration by removing an unused variable and replacing dynamic queue-claim SQL with a direct `pgmq.read` call.
- Addressed the independent reviewer blocker by adding queue-name allowlist checks to the legacy `claim_job`, `delete_job`, `archive_job`, and `send_to_queue` RPC helpers before they call `pgmq`.
- Added regression coverage to keep those helper RPCs restricted to `ingestion-queue`, `processing-queue`, and `delivery-queue`.
- Synced the canonical `scheduler-queue` OpenSpec with the R-11F transactional acknowledgement, delivery-state, and DLQ-ordering requirements.

**Verification performed**

- `npm run supabase:reset` passed and replayed migrations through `20260703230000_r11f_queue_transactional_ack.sql`.
- `npm run supabase:lint` passed with no schema errors.
- `npm run test:integration` passed: 2 files, 3 tests.
- `npm run test -- packages/browser/src/lib/queue-worker.test.ts` passed: 1 file, 5 tests.
- `npx -y @fission-ai/openspec@1.5.0 show r-11f-repair-queue-ack` passed, resolving the plain `npx openspec` executable issue by using the pinned package.
- `npx -y @fission-ai/openspec@1.5.0 validate r-11f-repair-queue-ack --strict` passed.
- `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` passed in the reviewer pass.
- `git diff --check` passed.
- `npm run deno:check` passed in the verifier pass.

**Closure**

- Fresh independent verifier PASS and reviewer APPROVE reports are retained in the archived OpenSpec change.
- Archived the change as `openspec/changes/archive/2026-07-04-r-11f-repair-queue-ack/` and marked R-11F done in the roadmap. R-11G is the next remediation slice.

### 2026-07-04 — R-11G retention lifecycle maker checkpoint

**AI contribution**

- Selected R-11G as the next dependency-ready remediation slice after R-11F.
- Created OpenSpec change `r-11g-retention-metadata-lifecycle`.
- Replaced `cleanup_runs()` so seven-day deletion targets content-bearing articles, digests, and delivery attempts, while sanitized source/processing run metadata lives for 30 days.
- Changed operational metadata cleanup to delete only resolved operational events after 30 days and retain unresolved failures.
- Changed integration circuit cleanup to delete only closed stale circuits while retaining open and half-open circuit state.
- Added Supabase integration coverage for content purge, run metadata retention, unresolved failure retention, resolved metadata deletion, and open/closed circuit cleanup.
- Set Supabase integration test file execution to sequential because those tests share one local database and existing setup deletes shared tables.

**Verification performed by maker**

- `npm run supabase:reset` passed.
- `npm run supabase:lint` passed with no schema errors.
- `npm run test:integration` passed: 3 files, 4 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npx -y @fission-ai/openspec@1.5.0 validate r-11g-retention-metadata-lifecycle --strict` passed.
- `git diff --check` passed.

**Not complete**

- R-11G still needs independent verifier PASS and reviewer APPROVE reports before archive.

### 2026-07-04 — R-11G closure

**Closure**

- Independent verifier PASS and reviewer APPROVE reports are retained in the OpenSpec change.
- The verifier reran `npm run supabase:reset`, `npm run supabase:lint`, `npm run test:integration`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run deno:check`, pinned OpenSpec validation, and `git diff --check`.
- The reviewer approved the final diff after checking retention semantics, service-role cleanup exposure, idempotency, and sequential Supabase integration execution.
- Archived the change as `openspec/changes/archive/2026-07-04-r-11g-retention-metadata-lifecycle/` and marked R-11G done in the roadmap. R-11H is the next remediation slice.

### 2026-07-04 — R-11H outbound SSRF hardening maker checkpoint

**AI contribution**

- Selected R-11H as the next dependency-ready remediation slice after R-11G.
- Created OpenSpec change `r-11h-harden-outbound-ssrf`.
- Added a protected outbound fetch helper that revalidates URLs immediately before fetch, disables native redirects, and manually follows only explicitly allowed redirects after validating each redirect target.
- Routed Slack and generic webhook verification through the protected helper with redirects disabled.
- Added regression tests for DNS rebinding-style private resolution at fetch time, unsafe redirect targets, safe relative redirects, and no-redirect behavior.
- Synced the canonical source-management and delivery-channel specs with the R-11H requirements.

**Verification performed by maker**

- `npm run test -- packages/browser/src/lib/ssrf.test.ts` passed: 1 file, 21 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed after formatting the SSRF test file.
- `npm run deno:check` passed.
- `npx -y @fission-ai/openspec@1.5.0 validate r-11h-harden-outbound-ssrf --strict` passed.
- `git diff --check` passed.

**Not complete**

- The first successful independent reviewer returned REQUEST CHANGES because Slack
  and generic webhook verification could allow a second protected pre-fetch SSRF
  validation error to escape the declared `{ success: false }` contract.
- The maker fixed that blocker by mapping `SsrfProtectionError` from Slack and
  generic webhook protected fetches to safe verification failures and added
  public-then-private DNS rebinding regressions that assert fetch is not invoked.
- The final independent reviewer approved the repaired diff with no blocking
  findings. A non-blocking redirect-budget cleanup remains documented in the
  R-11H review artifact.
- The independent verifier passed targeted API/SSRF unit tests, typecheck, lint,
  format, Deno check, pinned OpenSpec validation, `git diff --check`, and direct
  implementation/regression inspection.

### 2026-07-04 — R-11H closure

**Closure**

- Independent verifier PASS and reviewer APPROVE reports are retained in the OpenSpec change.
- The verifier reran `npm run test -- packages/browser/src/lib/api-helpers.test.ts packages/browser/src/lib/ssrf.test.ts`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run deno:check`, pinned OpenSpec validation, and `git diff --check`.
- The reviewer approved the final repaired diff after checking the Slack/generic
  webhook rebind failure path, protected fetch behavior, and the new regression tests.
- Archived the change as
  `openspec/changes/archive/2026-07-04-r-11h-harden-outbound-ssrf/` and marked
  R-11H done in the roadmap. R-11I is the next remediation slice.

### 2026-07-04 — R-11I OpenSpec hygiene maker checkpoint

**AI contribution**

- Selected R-11I after R-11H archive because R-12 depends on the audit
  remediation gate.
- Created OpenSpec change `r-11i-reconstruct-openspec-hygiene`.
- Replaced generated placeholder `Purpose` text in canonical OpenSpec specs
  with concise ownership and upstream-traceability summaries.
- Added `packages/browser/src/lib/openspec-hygiene.test.ts` to enforce that
  canonical specs have meaningful purposes and upstream ID traceability.
- Added archive hygiene coverage requiring every non-legacy archive to retain
  complete tasks plus separate `verification.md` and `review.md` reports.
- Kept R-01..R-11 legacy archive gaps explicit instead of rewriting task
  checkboxes or inventing retrospective checker evidence.

**Verification performed by maker**

- `npm run test -- packages/browser/src/lib/openspec-hygiene.test.ts` passed:
  1 file, 3 tests.
- `npm run test` passed: 8 files, 98 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npx -y @fission-ai/openspec@1.5.0 validate r-11i-reconstruct-openspec-hygiene --strict` passed.
- `git diff --check` passed.

**Not complete**

- The first bounded reviewer requested changes because archive-evidence
  enforcement only checked file existence and absence of unchecked tasks.
- The maker tightened the hygiene test so non-legacy archives must retain at
  least one checked task, no unchecked tasks, non-empty verifier/reviewer
  reports, verifier PASS evidence, reviewer APPROVE evidence, and no unresolved
  request-changes history.
- The final independent verifier passed the focused hygiene test, full unit
  suite, typecheck, lint, format, pinned OpenSpec validation, `git diff --check`,
  and direct inspections.
- The final independent reviewer approved the repaired diff with no findings.

### 2026-07-04 — R-11I closure

**Closure**

- Independent verifier PASS and reviewer APPROVE reports are retained in the OpenSpec change.
- The verifier reran `npm run test -- packages/browser/src/lib/openspec-hygiene.test.ts`, `npm run test`, `npm run typecheck`, `npm run lint`, `npm run format`, pinned OpenSpec validation, and `git diff --check`.
- The reviewer approved the final repaired diff after checking the exact legacy
  allowlist, non-legacy archive evidence requirements, canonical purpose
  requirements, and no-secrets posture.
- R-11I is marked done in the roadmap. R-12 is the next remediation-dependent slice.

### 2026-07-04 — R-12 ingestion worker maker checkpoint

**AI contribution**

- Started R-12 after completing the R-11A..R-11I audit remediation gate.
- Added `fast-xml-parser`, `linkedom`, and `@mozilla/readability` to npm and
  Deno Edge import/lock configuration.
- Extended the `work` Edge Function with exported ingestion helpers for
  30-second SSRF-safe fetching, RSS/Atom parsing, Readability extraction,
  bounded response-size handling, hash-based deduplication through
  `source_item_fingerprints`, source failure tracking, automatic pausing after
  five failures, and operational event logging.
- Routed ingestion queue jobs through the ingestion handler before transactional
  queue acknowledgement.
- Added `packages/browser/src/lib/ingestion-worker.test.ts` covering RSS/Atom
  parsing, HTML extraction sanitization, unsafe redirect blocking before target
  fetch, duplicate filtering, source pause behavior, and worker queue
  acknowledgement ordering.
- Re-enabled the R-12 ingestion worker test in the root Vitest config.

**Verification performed by maker**

- `npm run test -- packages/browser/src/lib/ingestion-worker.test.ts` passed:
  1 file, 11 tests.
- `npm run test` passed: 9 files, 109 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npm run deno:check` passed.
- `npm run deno:lint` passed.
- `npm run deno:fmt` passed after applying Deno formatting to Edge files.
- `npm run deno:lock` passed after updating `supabase/functions/deno.lock`.
- `npm run test:integration` passed: 3 files, 4 tests.
- `npm audit` passed with 0 vulnerabilities.
- `npm run deno:outdated` exited 0 and reported an existing compatible
  `@supabase/server` update; this remains dependency-update metadata, not a
  security advisory.
- `npx -y @fission-ai/openspec@1.5.0 validate r-12-ingestion-worker --strict` passed.
- `git diff --check` passed.

**Review fixes applied**

- Independent reviewer requested changes for body-size enforcement after full
  buffering, body-read timeout coverage, and raw external error logging.
- The worker now streams response bodies with byte counting and cancels reads as
  soon as the limit is exceeded.
- The fetch timeout now covers response body reads, including stalled streams.
- Feed publication dates are normalized before database writes; invalid dates
  become `null`.
- Ingestion failures are mapped to safe error categories in source-health
  operational events and worker responses, while internal queue acknowledgement
  failures remain visible for operational diagnosis.
- Focused ingestion tests now include oversized body, stalled body timeout,
  invalid date normalization, and safe error category regressions.

**Not complete**

- The final independent verifier passed all requested gates and inspected the
  streaming body limit, body-read timeout, invalid-date normalization, safe
  error handling, and regression tests.
- The final independent reviewer approved with no blocking findings. A
  non-blocking residual risk remains: article and fingerprint writes are
  separate operations, so a concurrent uniqueness race can still count as a
  source failure even though pre-insert dedupe checks are implemented.

### 2026-07-04 — R-12 closure

**Closure**

- Independent verifier PASS and reviewer APPROVE reports are retained in the OpenSpec change.
- The verifier reran focused ingestion tests, full unit tests, typecheck, lint,
  format, Deno check/lint/fmt/lock, Supabase integration tests, npm audit,
  pinned OpenSpec validation, and `git diff --check`.
- The reviewer approved the repaired final diff after checking the prior
  streaming body limit, timeout, safe-error, SSRF, dedupe, source-health, and
  queue-acknowledgement findings.
- R-12 is marked done in the roadmap. R-13 is the next processing-pipeline slice.

### 2026-07-04 — R-13 AI processing worker maker checkpoint

**AI contribution**

- Created OpenSpec change `r-13-ai-processing-worker` for the processing worker
  slice.
- Extended the `work` Edge Function with processing helpers for flow/source
  selection, same-run claim reuse, new-article claiming through `flow_articles`,
  `no_content` outcomes, n-gram Jaccard near-duplicate grouping, per-article and
  total input budgets, OpenAI Responses strict JSON-schema request construction,
  structured response parsing, and digest usage persistence.
- Added migration `20260704165230_r13_preserve_processing_no_content.sql` so
  transactional queue completion preserves `processing_runs.status =
  no_content`, and so digest persistence plus current-run article inclusion
  happen in one service-role RPC transaction. The migration now also records
  `processing_enqueued_at`, enqueues one processing job after all flow sources
  for a cycle are terminal through either successful or failed ingestion, and
  deletes undigested current-run claims when an exhausted processing job is
  archived.
- Added `packages/browser/src/lib/processing-worker.test.ts` covering
  no-content completion, claim/idempotency behavior, near-duplicate grouping,
  truncation budgets, strict structured response parsing, usage persistence,
  sanitized provider failure handling, and reuse of an already-persisted digest
  when queue acknowledgement failed after digest persistence. Reviewer-requested
  regressions now also cover incomplete existing-digest link repair and the one
  schema repair attempt required by the architecture contract.
- Extended queue SQL regression coverage to assert the processing-queue
  handoff and terminal failed-claim cleanup contracts.
- Added a reviewer-requested candidate-selection regression so already-claimed
  articles are filtered before the 50-article cap is applied.
- Checked official OpenAI docs on 2026-07-04 for Responses structured output via
  `text.format` with `type: "json_schema"` and `strict: true`, plus usage
  metadata under `usage.total_tokens`. Checked the Supabase changelog on
  2026-07-04; no breaking item affected this worker path.

**Verification performed by maker**

- `npx vitest run packages/browser/src/lib/processing-worker.test.ts` passed:
  1 file, 8 tests.
- `npm run typecheck` passed.
- `npm run lint` passed after removing an unused grouping placeholder.
- `npm run format` passed after formatting the new test file.
- `npm run test` passed: 10 files, 120 tests.
- `npm run deno:check` passed.
- `npm run deno:lint` passed.
- `npm run deno:fmt` passed after applying Deno formatting to
  `supabase/functions/work/index.ts`.

**Not complete**

- Independent verifier PASS and reviewer APPROVE reports are retained in the
  archived OpenSpec change after multiple checker-requested repairs.
- R-13 is marked done in the roadmap. R-14 delivery workers are next.

### 2026-07-04 — R-14 delivery workers maker checkpoint

**AI contribution**

- Created OpenSpec change `r-14-delivery-workers` for the delivery runtime
  slice.
- Added migration `20260704183308_r14_delivery_workers.sql` to create delivery
  attempts from digest persistence, enqueue ID-only `delivery-queue` messages,
  claim delivery attempts atomically, record retry/backoff state, update channel
  failure counters, and manage integration circuit probes/resets.
- Extended the `work` Edge Function with delivery adapters for in-app, Brevo
  transactional email, Telegram bot messages, Slack incoming webhooks, and
  generic signed webhooks.
- Added per-attempt webhook SSRF revalidation, no-redirect webhook behavior,
  generic webhook HMAC signing headers, bounded delivery timeouts, retryable vs
  permanent response classification, and `Retry-After` handling.
- Added focused delivery worker tests and extended queue SQL/integration tests
  for adapter payloads, webhook signatures, redirect blocking, permanent
  failure acknowledgement, digest-to-attempt creation, retry backoff, and
  circuit rows.
- Checked Supabase changelog on 2026-07-04; no R-14-relevant breaking item
  affected Edge Functions, queues, or migrations. Checked current Brevo,
  Telegram, and Slack HTTP contract shapes for the adapter request bodies.

**Verification performed by maker**

- `npx vitest run packages/browser/src/lib/delivery-worker.test.ts
  packages/browser/src/lib/queue-worker.test.ts` passed: 2 files, 14 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npm run test` passed: 11 files, 127 tests.
- `npm run deno:check` passed.
- `npm run deno:lint` passed.
- `npm run deno:fmt` passed.
- `npm run supabase:reset` passed and applied the R-14 migration locally.
- `npm run supabase:lint` passed with no schema errors.
- `npm run test:integration` passed: 3 files, 4 tests.
- `npx -y @fission-ai/openspec@1.5.0 show r-14-delivery-workers` and
  `npx -y @fission-ai/openspec@1.5.0 validate r-14-delivery-workers --strict`
  passed.

**Not complete**

- Independent verifier and reviewer passes are pending. R-14 remains `in review`
  until checker reports are retained and blocking findings, if any, are fixed.

**Checker repair loop**

- The first independent verifier attempt found an integration isolation failure:
  the retry/circuit test reused a static circuit key and observed
  `consecutive_failure_count = 2` after a previous run. The test now uses a
  unique circuit key per run.
- The independent reviewer requested changes for three delivery state-machine
  defects: duplicate delivered jobs could regress attempts to `failed`,
  not-yet-due retry jobs could increment failure counters without contacting a
  provider, and fetch/timeout transport errors could lose retry/circuit
  classification.
- The worker now treats already-delivered attempts as idempotent queue
  acknowledgements, requeues not-yet-due attempts with a delivery delay, and
  wraps `AbortError`/network `TypeError`/SSRF failures into scoped delivery
  errors before recording failure state.
- The migration now includes `acknowledge_delivery_worker_job` and
  `requeue_delivery_worker_job` RPCs so those no-failure paths still update the
  queue transactionally.
- Focused R-14 tests now include delivered-duplicate acknowledgement,
  not-yet-due requeue, and transport failure circuit-scope regressions.
- Post-fix maker reruns passed: focused delivery/queue Vitest, `npm run
  typecheck`, `npm run deno:check`, `npm run deno:lint`, `npm run deno:fmt`,
  `npm run supabase:reset`, `npm run supabase:lint`, `npm run
  test:integration`, `npm run verify:local`, OpenSpec strict validation, and
  `git diff --check`.
- The final verifier rerun passed focused delivery/queue tests, `npm run
  verify:local`, `npm run supabase:lint`, `npm run test:integration`, OpenSpec
  strict validation, and `git diff --check`. The final reviewer approved with
  no blocking findings and one non-blocking note about keeping SQL skip-path
  coverage executable in later reliability work.

### 2026-07-04 — R-14 closure

**Closure**

- Independent verifier PASS and reviewer APPROVE reports are retained in the
  OpenSpec change before archive.
- R-14 is marked done in the roadmap. R-15 feedback capture is the next
  processing-pipeline slice.

### 2026-07-04 — R-15 feedback capture maker checkpoint

**Human direction**

- Asked to push current `main`, wait for CI results, fix if needed, and continue
  development on `main`.

**AI contribution**

- Pushed R-14 commit `ec12104` to `origin/main`.
- Confirmed GitHub `CodeQL` and `CI` both passed for the pushed R-14 commit, so
  no CI repair was required before continuing.
- Created OpenSpec change `r-15-feedback-capture` for `BR-FLOW-08`.
- Added authenticated digest reporting and feedback update routes to the API
  helper. The routes derive ownership from JWT user ID via owned
  `processing_flows`, return feedback counts from the visible digest set, and
  update only `processed_digests.user_feedback`.
- Added a browser digest feedback helper and dashboard `Digests` panel with
  digest history, counts, thumbs up/down toggles, clear action, loading state,
  and API error display.
- Added API route tests and browser helper tests for report fetch, update,
  clear, invalid feedback rejection, error display, and cross-user no-update
  behavior.
- Checked the Supabase changelog on 2026-07-04; no recent breaking item changes
  this route because R-15 adds no new table and uses existing authenticated Edge
  Function/Data API behavior.

**Verification performed by maker**

- `npx -y @fission-ai/openspec@1.5.0 validate r-15-feedback-capture --strict`
  passed.
- `npx vitest run packages/browser/src/lib/api-helpers.test.ts
  packages/browser/src/lib/digest-feedback.test.ts` passed: 2 files, 63 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed after `npm run format:write`.
- `npm run test` passed: 12 files, 140 tests.
- `npm run deno:check` passed.
- `npm run deno:lint` passed.
- `npm run deno:fmt` passed after applying `npx deno fmt` to the API helper.

**Not complete**

- Independent reviewer `Fermat` approved the final diff with no blocking
  findings. Non-blocking notes were to add a targeted update-error helper test
  if this area changes again and to consider clearer thumbs visuals for the
  dashboard buttons.
- Several broad verifier sub-agent attempts hung before returning artifacts.
  The retained verifier report therefore uses bounded evidence from separate
  tiny verifier sub-agent runs: focused R-15 Vitest passed, `npm run typecheck`
  passed, OpenSpec strict validation passed, and `git diff --check` passed.
- R-15 was archived as
  `openspec/changes/archive/2026-07-05-r-15-feedback-capture/`, creating the
  canonical `digest-feedback` spec.
- R-15 was committed as `10b5fe5` and pushed to `origin/main`. GitHub
  `CodeQL` and `CI` both passed for that commit.

### 2026-07-05 — R-15 closure

**Closure**

- Independent reviewer APPROVE and bounded independent verifier PASS reports
  are retained in the archived OpenSpec change.
- R-15 is marked done in the roadmap. R-16 retention/cleanup is the next Phase
  4 slice.

### 2026-07-05 — R-16 lifecycle cleanup maker checkpoint

**AI contribution**

- Created OpenSpec change `r-16-lifecycle-cleanup`.
- Audited the existing R-11F/R-11G/R-13/R-14 queue, cleanup, and schedule
  implementation against R-16 lifecycle requirements.
- Added focused queue-worker regression assertions for 30-minute cleanup
  cadence, seven-day article/digest/delivery-attempt purge, 30-day sanitized
  metadata retention, unresolved operational-event retention, active circuit
  preservation, exact sanitized DLQ context, and absence of separate durable
  news-content storage or content-bearing queue payloads.
- Extended Supabase cleanup integration coverage so the database executes
  cleanup and proves stale source-fetch, processing, and delivery leases are
  reset to pending with cleared lease fields.
- Checked the Supabase changelog on 2026-07-05; no recent cleanup,
  `pg_cron`, Edge Function, or migration breaking change changes the R-16
  approach. The relevant historical `pg_cron` breaking item is satisfied
  because the project uses `cron.schedule` instead of direct `cron.job` writes.

**Verification performed by maker**

- `npx vitest run packages/browser/src/lib/queue-worker.test.ts` passed: 1 file,
  15 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed after applying Prettier to the changed test file.
- `npm run test` passed: 12 files, 145 tests.
- `npm run deno:check`, `npm run deno:lint`, and `npm run deno:fmt` passed.
- `npm run supabase:lint` passed against the local database.
- `npm run test:integration` passed: 3 files, 5 tests, including the new stale
  lease recovery scenario.
- `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` passed.
- `git diff --check` passed.

**Checker loop**

- First independent reviewer pass requested changes because the initial tests
  were too text-fragment focused and did not prove stale lease recovery, DLQ
  context sanitization, or durable queue/cache payload posture. The maker added
  integration and unit evidence for those gaps, then both checker passes were
  rerun on the final diff.

### 2026-07-05 — R-16 lifecycle cleanup closure

**Closure**

- Fresh independent verifier PASS and independent reviewer APPROVE reports are
  retained in
  `openspec/changes/archive/2026-07-05-r-16-lifecycle-cleanup/`.
- Archived `r-16-lifecycle-cleanup`, creating the canonical
  `lifecycle-cleanup` spec and updating `scheduler-queue`.
- R-16 is marked done in the roadmap. R-17 observability is the next Phase 4
  slice.

### 2026-07-05 — R-17 observability guardrails maker checkpoint

**AI contribution**

- Created OpenSpec change `r-17-observability-guardrails`.
- Added a Supabase migration for atomic alert-claim deduplication, content-free
  failed AI usage accounting, AI token usage aggregation, and terminal budget
  failure acknowledgement RPCs, restricted to `service_role`/`postgres`.
- Added structured sanitized logs for worker, scheduler, and cleanup
  invocations.
- Added critical operational-event alert delivery through the existing Brevo
  adapter path, with database-backed one-hour dedupe.
- Added daily and per-response AI token budget guardrails that fail closed,
  record sanitized `provider_quota` events, count failed response usage, and
  terminally acknowledge budget-exhausted processing jobs to avoid repeat
  provider spend.
- Added `.env.example` placeholders for the new non-secret configuration names.
- Added focused coverage for alert-claim RPC failures so operator alerting
  remains non-blocking when the dedupe claim cannot be completed.
- Fixed the reviewer-reported schema-repair budget bypass: OpenAI response
  usage is now checked before schema validation/repair, over-budget malformed
  responses are terminal, and under-budget schema-invalid responses are recorded
  as failed provider usage before repair.

**Verification performed by maker so far**

- `npx vitest run packages/browser/src/lib/queue-worker.test.ts
  packages/browser/src/lib/processing-worker.test.ts` passed: 2 files, 31
  tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npm run test` passed: 12 files, 152 tests.
- `npm run deno:check`, `npm run deno:lint`, and `npm run deno:fmt` passed
  after applying Deno formatting to `supabase/functions/work/index.ts`.
- `npm run supabase:reset` applied the R-17 migration locally.
- `npm run supabase:lint` passed.
- `npm run test:integration` passed: 3 files, 5 tests.
- `npm run verify:local` passed, including coverage, Deno lock/outdated, npm
  audit, browser build, and Playwright smoke e2e.
- `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` passed.
- `git diff --check` passed.

**Checker loop and closure**

- The first independent reviewer pass requested changes for a schema-repair
  budget bypass. The maker fixed the bypass by checking response usage before
  schema parsing/repair, recording over-budget malformed responses as
  `failed_budget`, recording under-budget schema-invalid responses as
  `failed_provider` before the one repair attempt, and keeping exhausted
  processing jobs on the terminal acknowledgement path.
- Fresh independent verifier PASS and independent reviewer APPROVE reports are
  retained in
  `openspec/changes/archive/2026-07-05-r-17-observability-guardrails/`.
- Archived `r-17-observability-guardrails`, creating the canonical
  `observability-guardrails` spec. R-17 is marked done in the roadmap. R-18
  dashboard polish and responsive e2e is the next Phase 4 slice.
- R-17 was committed as `d24e00f` and pushed to `origin/main`. GitHub `CI` run
  `28738906497` and `CodeQL` run `28738906512` both passed for that commit.

### 2026-07-05 — R-18 dashboard polish proposal checkpoint

**AI contribution**

- Created OpenSpec change `r-18-dashboard-polish-e2e`.
- Read the approved frontend design system, responsive UX requirements, quality
  standards, current browser shell, digest feedback panel, source panel, flow
  panel, and existing Playwright smoke test.
- Scoped R-18 to responsive dashboard polish and deterministic Playwright
  coverage for digest history, flow run/status summaries, source warnings, and
  navigation.

**Verification performed so far**

- `npx vitest run packages/browser/src/lib/dashboard-summary.test.ts` passed: 1
  file, 2 tests.
- `npm run typecheck`, `npm run lint`, and `npm run format` passed.
- `npm run test` passed: 13 files, 154 tests.
- `npm run build:browser` passed.
- `npm run test:e2e` passed: 3 Chromium tests covering login shell, desktop
  authenticated overview, and mobile digest feedback.
- `npm run verify:local` passed, including coverage, Deno gates, npm audit,
  browser build, and Playwright smoke/responsive e2e.
- `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` passed: 18 items.
- `git diff --check` passed.

**Checker loop**

- First independent reviewer pass requested changes because source warnings were
  scoped to the first flow and existing panels still had mobile-hostile grid
  minimums. The maker changed the overview to read all user-owned source links,
  dedupe shared sources, made existing panel grid tracks mobile-safe, and
  extended mobile e2e coverage across all authenticated tabs.
- Fresh independent verifier PASS and independent reviewer APPROVE reports are
  retained in the active change.

**Closure**

- R-18 was archived as
  `openspec/changes/archive/2026-07-05-r-18-dashboard-polish-e2e/`, creating the
  canonical `dashboard-responsive-ux` spec and updating `digest-feedback`,
  `flow-management`, and `source-management`.
- R-18 was committed as `0ab150d`, pushed to `origin/main`, and passed GitHub
  `CI` run `28740303146` plus `CodeQL` run `28740303150`. No CI repair was
  required before continuing.

### 2026-07-05 — R-19 deploy config bootstrap maker checkpoint

**AI contribution**

- Created OpenSpec change `r-19-deploy-config-bootstrap` for the Phase 4
  deployment/bootstrap slice.
- Added a `deployment-bootstrap` capability and updated the
  `cicd-security-gates` capability so deployment audit becomes a committed
  verification gate.
- Added root `vercel.json` for Vercel Hobby static frontend deployment with
  browser workspace build/output settings, SPA fallback rewrites, security
  headers, and cache headers.
- Added read-only `infra/scripts/audit-deployment.mjs` and
  `infra/scripts/bootstrap-check.mjs` scripts. They validate committed
  deployment config, required environment variable names, ignored private
  provider-state paths, and human-bootstrap items without printing secret
  values or mutating providers.
- Added `infra:audit` and `infra:bootstrap-check` npm scripts; `verify:local`
  and CI now include the deployment audit.
- Added focused Vitest coverage for audit secret-safety and static-only Vercel
  configuration.
- Added Telegram and scheduler secret names to `.env.example`, and ignored
  `.vercel/` provider link state.

**Verification performed by maker so far**

- `npm run infra:audit` passed.
- `npm run infra:bootstrap-check` passed and reported human-gated provider
  actions without secrets.
- `npx vitest run packages/browser/src/lib/deployment-audit.test.ts` passed: 1
  file, 2 tests.
- `npm run typecheck` passed.
- `npm run lint` passed after adding a scoped Node-global ESLint config for
  `infra/scripts/**/*.mjs`.
- `npm run format` passed after formatting the new scripts/tests/specs.
- `npx -y @fission-ai/openspec@1.5.0 validate
  r-19-deploy-config-bootstrap --strict` passed.
- `npm run test` passed: 14 files, 156 tests.
- `npm run build:browser` passed.
- `actionlint .github/workflows/actionlint.yml .github/workflows/ci.yml
  .github/workflows/codeql.yml .github/workflows/dependency-review.yml` passed.
- `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` passed: 19
  items.
- `git diff --check` passed.
- `npm run verify:local` passed, including typecheck, lint, format, infra
  audit, unit tests, coverage, Deno check/lint/fmt/lock/outdated, npm audit,
  browser build, and Playwright e2e.

**Checker loop and closure**

- Independent verifier PASS and independent reviewer APPROVE reports are
  retained in the active change. The reviewer recorded one non-blocking
  follow-up to tighten the broad CSP `connect-src` after human bootstrap
  provides exact production origins.
- Archived `r-19-deploy-config-bootstrap`, creating the canonical
  `deployment-bootstrap` spec and updating `cicd-security-gates`.
- R-19 still needs commit, push, and hosted CI confirmation.
- Human bootstrap remains required for Supabase/Vercel project creation,
  provider secrets, OAuth app registration, hosted repository security settings,
  and production deployment.

### 2026-07-05 — R-19 CI repair checkpoint

**AI contribution**

- Committed and pushed R-19 as `ceaa367`.
- GitHub `CI` run `28740803977` failed in
  `packages/browser/src/lib/crypto.test.ts` before Supabase gates. The failure
  was unrelated to the R-19 deployment audit step, which passed in CI.
- Root cause: the test attempted to tamper ciphertext with
  `encrypted.ciphertext.replace(/a/g, 'b')`; when the random base64 ciphertext
  contains no `a`, the test does not alter authenticated data and decryption
  correctly resolves.
- Repaired the test to decode the base64 ciphertext, flip the first byte, and
  re-encode it before asserting AES-GCM decryption rejects.

**Verification performed**

- `npx vitest run packages/browser/src/lib/crypto.test.ts` passed: 1 file, 10
  tests.
- `npm run test` passed: 14 files, 156 tests.
- `npm run lint` passed.
- `npm run format` passed.
- `git diff --check` passed.

**Closure**

- Repair commit `fa0bf6f` was pushed to `origin/main`.
- GitHub `CI` run `28740880409` passed all quality gates, including the new
  deployment config audit, unit/coverage, Deno gates, browser build/e2e,
  Supabase migration lint, and Supabase integration tests.
- GitHub `CodeQL` run `28740880398` passed.
- Final R-19 documentation closure commit `b5d4000` was pushed to `origin/main`.
  GitHub `CI` run `28741013482` and `CodeQL` run `28741013480` passed.

### 2026-07-05 — R-20 browser auth lifecycle maker checkpoint

**AI contribution**

- Created OpenSpec change `r-20-browser-auth-lifecycle`.
- Added a `supabase-auth` spec delta for OAuth callback/session restoration,
  protected dashboard routing, logout, and production-hidden password controls.
- Checked current Supabase JavaScript auth docs and changelog on 2026-07-05.
  No relevant hosted Supabase JS/Auth breaking change affected this browser
  lifecycle slice.
- Added typed browser auth routing helpers for callback detection, dashboard tab
  path mapping, safe same-origin dashboard return paths, OAuth callback error
  sanitization, and dev-password-auth gating.
- Wired the browser shell to use `/auth/callback`, preserve only safe dashboard
  return paths, show protected routes through the sign-in shell when no session
  exists, restore authenticated dashboard deep links, synchronize tab changes to
  `/dashboard/...` paths, clear route/session UI on logout, and hide password
  auth controls outside local development or an explicit dev/test flag.
- Expanded Playwright smoke coverage for unauthenticated protected routes,
  callback errors, authenticated fixture callback restoration, deep links,
  logout, and mobile overflow.
- Fixed a coverage-only timeout in the existing Telegram channel verification
  test path by passing the existing DNS resolver hook through Telegram's
  SSRF-protected fetch call and supplying a safe Telegram IP in the success
  test. This avoids external DNS timing during coverage and keeps runtime
  outbound validation behavior consistent with Slack/webhook verification.

**Verification performed so far**

- `openspec validate r-20-browser-auth-lifecycle --strict` passed.
- `npx vitest run packages/browser/src/lib/auth-routing.test.ts` passed: 1
  file, 5 tests.
- `npx vitest run packages/browser/src/lib/api-helpers.test.ts -t "should
  verify Telegram with the app-owned bot token"` passed: 1 test, 57 skipped.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npm run test` passed: 15 files, 161 tests.
- `npm run test:coverage` passed with configured thresholds.
- `npm run build:browser` passed.
- `npm run test:e2e` passed: 10 Chromium tests, including regressions that
  callback error parameters take precedence over e2e fixture sessions, OAuth-like
  error parameters are ignored outside `/auth/callback`, and logout clears local
  dashboard UI even when remote sign-out fails.
- `npm run verify:local` passed, including typecheck, lint, format, infra
  audit, unit tests, coverage, Deno check/lint/fmt/lock/outdated, npm audit,
  browser build, and Playwright e2e.
- `npm run supabase:lint` passed with no schema errors.
- `npm run test:integration` passed: 3 files, 5 tests.
- `openspec validate --all --strict` passed: 20 items.
- `git diff --check` passed.

**Checker loop and closure**

- First independent reviewer pass requested changes for overly broad callback
  error parsing and logout failure local-state cleanup. Both were fixed and the
  checker passes were rerun on the final diff.
- Fresh independent verifier PASS is retained in
  `openspec/changes/archive/2026-07-05-r-20-browser-auth-lifecycle/verification.md`.
  The verifier ran focused auth-routing and Telegram tests, typecheck, lint,
  format, unit tests, browser build, 10-test Playwright e2e, Supabase lint,
  Supabase integration tests, Deno Edge gates for the touched API helper,
  OpenSpec strict validation, and `git diff --check`.
- Fresh independent reviewer APPROVE is retained in
  `openspec/changes/archive/2026-07-05-r-20-browser-auth-lifecycle/review.md`.
  The reviewer confirmed the earlier callback-error and logout blockers are
  fixed. The reviewer noted a non-blocking verifier artifact count mismatch
  before the verifier report was refreshed; the archived verifier report now
  records the current 10-test Playwright suite.
- Archived `r-20-browser-auth-lifecycle`, syncing the browser auth lifecycle
  requirements into the canonical `supabase-auth` spec.
- R-20 was committed as `45af8dd`, pushed to `origin/main`, and passed GitHub
  `CI` run `28745843691` plus `CodeQL` run `28745843672`.

### 2026-07-06 — Local Supabase function startup repair

**AI contribution**

- Started local Supabase Edge Functions and the Vite browser app so the human
  could interact with `/dashboard/profile`.
- Investigated the browser error `Function not found` and then the subsequent
  local function boot/auth failures.
- Added missing Supabase JS import-map entries for Edge Function runtime imports.
- Changed the API Edge Function wrapper to use user-JWT auth with a public
  fallback for handler-gated health checks instead of accepting only
  publishable/secret API keys.
- Added local Edge Runtime route normalization for `/api/...` paths, which the
  local function worker passes to handlers, while preserving hosted
  `/functions/v1/api/...` behavior.
- Added a regression test for authenticated `/api/profiles` routing.

**Verification performed**

- `npm run deno:check` passed for all Edge Function entrypoints.
- `npx vitest run packages/browser/src/lib/api-helpers.test.ts` passed before
  the regression addition: 58 tests.
- `npx vitest run packages/browser/src/lib/api-helpers.test.ts` passed after
  the regression addition: 59 tests.
- `npm run deno:outdated` passed after aligning the API import-map Supabase JS
  specifier with the frozen Deno lockfile.
- Manual local probe of `GET /functions/v1/api/profiles` with a real local
  Supabase Auth user returned `200 OK` and the profile payload after the repair.
- Pushed commit `f5cc8df`; GitHub `CI` run `28783767075` failed at the Deno
  dependency update check because the import maps used
  `npm:@supabase/supabase-js@^2` while the lockfile was frozen to
  `npm:@supabase/supabase-js@^2.110.0`. The follow-up fix aligns the import-map
  specifier with the lockfile.
- Pushed follow-up commit `be9d1cf`; GitHub `CI` run `28783918460` passed all
  quality gates, and GitHub `CodeQL` run `28783918463` passed.

**Unresolved work**

- The browser and Edge Function dev servers remain running for interactive local
  testing.
- OAuth providers are not configured locally; use the dev email/password flow.

### 2026-07-06 — Non-technical deployment setup guide

**AI contribution**

- Added `docs/deployment_setup_guide.md` as a static, step-by-step operator
  guide for setting up deployment accounts, tokens, secrets, Vercel, Supabase,
  OAuth providers, OpenAI, Brevo, Telegram, GitHub secrets, final deployment
  order, smoke tests, and common deployment failures.
- Kept the guide aligned with the current repository shape: Vercel hosts only
  the static Vite frontend, Supabase owns the database/Auth/API/cron/worker
  runtime, and the existing GitHub workflows verify the project but do not yet
  provide a complete production deployment workflow.
- Rechecked current Supabase deployment/API-key documentation and changelog on
  2026-07-06; no recent Supabase breaking change changed this document's
  deployment setup instructions.

**Verification performed**

- `npx prettier --check docs/deployment_setup_guide.md docs/state.md
  docs/development_process.md` passed.
- `git diff --check` passed.
- `ls docs/deployment_setup_guide.md docs/state.md
  docs/development_process.md` confirmed the expected local documentation files
  exist.
- `rg "\\[[^\\]]+\\]\\([^\\)]+\\)" docs/deployment_setup_guide.md` found no
  local Markdown links requiring path validation; the guide uses plain official
  provider URLs.

### 2026-07-07 — Vercel root directory deployment correction

**Human correction**

- A Vercel production deployment failed during the browser build with
  `sh: line 1: tsc: command not found`.
- The logs showed Vercel ran the package-local `@news-aggregator/browser` build
  after installing only the browser package dependencies, which means the Vercel
  project was rooted at `packages/browser` instead of the repository root.

**AI contribution**

- Updated `docs/deployment_setup_guide.md` to explicitly leave the Vercel root
  directory at the repository root and added the `tsc: command not found`
  troubleshooting entry.

**Verification performed**

- `npx prettier --check docs/deployment_setup_guide.md docs/state.md
  docs/development_process.md` passed.
- `git diff --check` passed.

### 2026-07-07 — Supabase GitHub function declarations

**Human correction**

- After connecting Supabase to GitHub, no new Edge Functions appeared in the
  Supabase dashboard.

**AI contribution**

- Verified current Supabase GitHub integration documentation: production deploys
  apply migrations and deploy Edge Functions declared in `supabase/config.toml`.
- Added `schedule-daily`, `work`, and `cleanup` function declarations beside the
  existing `api` declaration in `supabase/config.toml`.
- Extended `infra/scripts/audit-deployment.mjs` so the local deployment audit
  requires all four production Edge Functions to be declared with entrypoints.
- Updated deployment and hosting docs to keep Vercel rooted at the repository
  root and to describe Supabase GitHub deployment of the four declared
  functions.

**Verification performed**

- `npm run format` passed.
- `npm run lint` passed.
- `npm run infra:audit` passed and now verifies all four Edge Function
  declarations.
- `npm run deno:check` passed for all Edge Function entrypoints.
- `npx vitest run packages/browser/src/lib/deployment-audit.test.ts` passed.
- `git diff --check` passed.

### 2026-07-07 — Supabase Preview config parser repair

**Human correction**

- Supabase Preview failed to parse `supabase/config.toml` with
  `invalid keys: local_smtp`.

**AI contribution**

- Verified the current Supabase CLI configuration docs list the local email test
  server under `[inbucket]`, not `[local_smtp]`.
- Replaced `[local_smtp]` with `[inbucket]` in `supabase/config.toml`.
- Restored the required `schedule-daily`, `work`, and `cleanup` function
  declarations that were missing from the local working copy.
- Extended the deployment audit to reject `[local_smtp]` and require
  `[inbucket]`.

**Verification performed**

- `npm run format` passed.
- `npm run lint` passed.
- `npm run infra:audit` passed and now rejects `[local_smtp]`.
- `npm run deno:check` passed for all Edge Function entrypoints.
- `npx vitest run packages/browser/src/lib/deployment-audit.test.ts` passed.
- `git diff --check` passed.

### 2026-07-08 — Hosted Supabase cron pg_net repair

**Human correction**

- A manual run of the hosted `schedule-daily-job` cron command failed with
  `ERROR: 3F000: schema "net" does not exist`.
- The failing command also showed production cron was still targeting the local
  Docker gateway URL `http://kong:8000/functions/v1/schedule-daily`.

**AI contribution**

- Verified current Supabase docs: scheduled Edge Function invocation uses
  `pg_cron` with `pg_net`, and `net.http_post` is provided by the `pg_net`
  extension.
- Added migration `20260707211433_repair_hosted_cron_pg_net.sql` to enable
  `pg_net`, unschedule the stale jobs, and recreate `schedule-daily-job`,
  `worker-drain-job`, and `cleanup-job` with URLs based on
  `app.settings.supabase_url`, falling back to local `http://kong:8000`.
- Documented the hosted database settings needed by cron:
  `app.settings.supabase_url` and `app.settings.service_role_key`.
- Added focused migration-source coverage for the hosted cron repair.

**Verification performed**

- `npm run format` passed.
- `npm run lint` passed.
- `npx vitest run packages/browser/src/lib/queue-worker.test.ts` passed.
- `npm run supabase:reset` passed and applied the new migration locally.
- `npm run supabase:lint` passed after the reset.
- `npm run test:integration` passed against the freshly reset local Supabase
  database.
- `git diff --check` passed.

### 2026-07-08 — Scheduled function auth alignment

**Human correction**

- Manual `curl` calls to `schedule-daily` still failed even when using the
  service-role value, while Supabase cron might work.

**AI contribution**

- Identified two auth layers: the `@supabase/server` `auth: 'secret'` wrapper
  expects a Supabase secret API key in the `apikey` header, while the handler
  expected the service-role key in `Authorization`.
- Removed the `@supabase/server` wrapper from `schedule-daily`, `work`, and
  `cleanup`; they now perform their own `Authorization` check against
  `SCHEDULER_SECRET`, with service-role authorization retained as a
  compatibility fallback.
- Added a migration that recreates cron jobs to prefer
  `app.settings.scheduler_secret` and fall back to
  `app.settings.service_role_key`.
- Updated deployment docs with the hosted database setting and manual `curl`
  command.

**Verification performed**

- `npm run format` passed.
- `npm run lint` passed.
- `npm run deno:check` passed for all Edge Function entrypoints.
- `npx vitest run packages/browser/src/lib/queue-worker.test.ts` passed.
- `npm run supabase:reset` passed and applied the new migration locally.
- `npm run supabase:lint` passed after the reset.
- `npm run test:integration` passed after updating integration invocations to
  use `SCHEDULER_SECRET`.
- `git diff --check` passed.

### 2026-07-08 — Scheduler diagnostics and forced smoke test

**Human correction**

- A manual HTTP call to `schedule-daily` returned
  `{"jobs_enqueued":0,"flows_processed":0}` even though the browser showed one
  enabled flow. The browser also showed the flow's next run was later the same
  day.

**AI contribution**

- Confirmed the scheduler RPC is due-only for normal cron calls:
  `next_run_at <= now()`. That makes zero enqueues expected before the visible
  next run time.
- Added an explicit `{"force": true}` operator path to `schedule-daily` so
  smoke tests can enqueue an active flow before its scheduled time without
  changing normal cron behavior.
- Replaced the scheduler RPC with a diagnostic version returning
  `active_flows`, `due_flows`, `skipped_not_due`, `skipped_existing_cycle`, and
  `next_due_at`.
- Repaired the existing-cycle edge case so a due flow with an already-created
  run advances instead of remaining stuck on the same cycle date.

**Verification performed**

- `npm run deno:check` passed for all Edge Function entrypoints.
- `npx vitest run packages/browser/src/lib/queue-worker.test.ts` passed.
- `npm run format` passed.
- `npm run lint` passed.
- `npm run supabase:reset` passed and applied the scheduler diagnostics
  migration locally.
- `npm run supabase:lint` passed after the reset.
- `npm run test:integration` passed with the forced scheduler path covered.
- `git diff --check` passed.

### 2026-07-08 — Forced scheduler existing-cycle repair

**Human correction**

- A forced `schedule-daily` call returned `skipped_existing_cycle: 1` and
  `jobs_enqueued: 0` while the browser still showed no retained digest and the
  source had not recorded a fetch.

**AI contribution**

- Identified that the forced scheduler recovery stopped when the
  `processing_runs(flow_id, cycle_date)` row already existed, before checking
  whether source fetch rows or ingestion queue messages were present.
- Added a follow-up migration that keeps the existing-cycle diagnostic but
  continues through source scheduling. It inserts missing `source_fetch_runs`,
  enqueues ingestion work, and avoids requeueing source runs that are already
  completed or actively processing.
- Extended integration coverage to reproduce an existing processing cycle with
  missing source work.

**Verification performed**

- `npx vitest run packages/browser/src/lib/queue-worker.test.ts` passed.
- `npm run deno:check` passed for all Edge Function entrypoints.
- `npm run format` passed.
- `npm run lint` passed.
- `npm run supabase:reset` passed and applied the follow-up migration locally.
- `npm run supabase:lint` passed after the reset.
- `npm run test:integration` passed with the existing-cycle recovery covered.
- `git diff --check` passed.

### 2026-07-08 — Digest content rendering

**Human correction**

- A generated digest appeared in the browser, but the Digests panel only showed
  shell metadata: title, timestamp, item count, and feedback buttons.

**AI contribution**

- Identified that stored digest content already contains
  `sections[].items[].summary`, but `DigestFeedbackPanel` never rendered those
  fields.
- Added digest-content parsing and visible rendering for section headings, item
  titles, summaries, and source links.
- Extended the browser smoke fixture to assert that a digest summary is visible
  on the Digests panel.

**Verification performed**

- `npm run format` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build:browser` passed.
- `npx playwright test tests/e2e/browser-smoke.spec.ts` passed and verified
  digest summary text is visible on mobile.
- `git diff --check` passed.

### 2026-07-08 — Digest row collapse and button contrast

**Human correction**

- Some gradient action buttons rendered dark text on a dark blue gradient, and
  full digest content made retained digest rows too tall by default.

**AI contribution**

- Set explicit white text on gradient action buttons in the auth shell,
  preferences, sources, flows, and delivery panels.
- Made retained digest content collapsed by default, with an accessible
  per-digest expand/collapse button while keeping row metadata and feedback
  controls visible.
- Updated the browser smoke test to prove summary text is hidden initially and
  appears after expansion on mobile.

**Verification performed**

- `npm run format` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build:browser` passed.
- `npx playwright test tests/e2e/browser-smoke.spec.ts` passed.
- Independent verifier PASS confirmed the same focused gates plus code
  inspection for button contrast, collapsed default state, expand/collapse
  control, and smoke coverage.
- Independent reviewer APPROVE found no blocking or non-blocking findings.

### 2026-07-08 — Telegram delivery setup guidance

**Human correction**

- The Telegram delivery setup copy was too thin: it did not show the concrete
  application bot or explain how operators obtain the Telegram chat ID.

**AI contribution**

- Rechecked the official Telegram Bot API documentation on 2026-07-08 for
  `setWebhook.secret_token`, `sendMessage`, and `chat_id` behavior.
- Added a `telegram-bot` Supabase Edge Function that accepts Telegram webhook
  updates, validates `X-Telegram-Bot-Api-Secret-Token`, extracts the incoming
  chat ID, and replies with where to paste it in the dashboard.
- Updated the Delivery tab Telegram path to show `@news_desk_ai_bot`, link to
  the bot, explain the direct-chat and group-chat auto-reply flow, and keep bot
  token collection out of the browser.
- Added deployment-guide instructions for `TELEGRAM_WEBHOOK_SECRET`,
  `telegram-bot` deployment, Telegram `setWebhook` registration, and Telegram's
  webhook secret token character constraints.
- Added OpenSpec change artifacts for the Telegram chat ID bot behavior and
  deployment declarations.
- Added browser smoke coverage for the Telegram bot identity and chat ID guide,
  plus unit coverage for the inbound Telegram webhook function.

**Verification performed**

- `npm run format` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed with 16 files and 170 tests after the existing
  Supabase-client proxy test was made deterministic against local `.env`
  values.
- `npm run build:browser` passed.
- `npm run deno:check`, `npm run deno:lint`, `npm run deno:fmt`, and
  `npm run deno:lock` passed with the new `telegram-bot` function included.
- `npm run infra:audit` passed and now checks `telegram-bot` plus
  `TELEGRAM_WEBHOOK_SECRET`.
- `npx -y @fission-ai/openspec@1.5.0 validate --all --strict` passed.
- `npx playwright test tests/e2e/browser-smoke.spec.ts --reporter=list` passed
  with 11 Chromium tests, including the Telegram setup guide assertion.
- `git diff --check` passed.
- Independent reviewer first requested changes for Telegram
  `setWebhook.secret_token` character constraints; the guide and OpenSpec
  design were updated to document `A-Z`, `a-z`, `0-9`, `_`, `-`, and length
  limits.
- Fresh independent verifier PASS and reviewer APPROVE found no remaining
  blocking findings.

### 2026-07-08 — Telegram digest delivery URL hotfix

**Human correction**

- New digests were visible in the web dashboard, but corresponding Telegram
  messages were not arriving.

**AI contribution**

- Rechecked the official Telegram Bot API on 2026-07-08: bot requests are made
  as `https://api.telegram.org/bot<token>/METHOD_NAME`, with the sample token
  shown raw in the path.
- Updated Telegram channel verification, digest delivery, and the Telegram
  chat-ID helper bot to keep the bot token raw in the Bot API path instead of
  percent-encoding the token colon.
- Added focused regressions proving Telegram verification, digest delivery, and
  chat-ID helper replies call the raw-token Bot API URL.

**Verification performed**

- `npx vitest run packages/browser/src/lib/delivery-worker.test.ts packages/browser/src/lib/api-helpers.test.ts packages/browser/src/lib/telegram-bot-function.test.ts` passed with 3 files and 70 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed after formatting the new test.
- `npm run deno:check` passed.
- `npm run deno:lint` passed.
- `git diff --check` passed.
- Separate verifier/reviewer sub-agents were not run in this hotfix turn because
  the available sub-agent tool is restricted to explicit user-requested
  delegation. This remains a process evidence gap, not production-readiness
  evidence.

### 2026-07-08 — Public landing page on Vercel

**Human correction**

- The initial wording about "github page" was clarified: the browser
  application should remain hosted on Vercel, and the landing page may also be
  served there.

**AI contribution**

- Created OpenSpec change artifacts for `r-21-public-landing-vercel` after
  correcting an initial GitHub Pages planning checkpoint with a follow-up change
  on `main`.
- Replaced the unauthenticated compact login card with a Vercel-served public
  landing page for the AI news desk, keeping Google/GitHub OAuth entry points,
  callback error display, protected-route sign-in behavior, and production-hidden
  password auth.
- Generated one project-local newsroom hero image and wired it into the browser
  build.
- Kept `vercel.json` as the static frontend hosting contract and updated the CSP
  to allow the landing page font endpoints and Supabase browser connections.
- Updated the deployment audit to verify the required CSP sources.

**Verification performed**

- `openspec validate r-21-public-landing-vercel --strict` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run format` passed.
- `npm run test` passed with 16 files and 171 tests.
- `npm run infra:audit` passed and now checks Vercel CSP sources needed by the
  landing page.
- `npm run build:browser` passed.
- `npx playwright test tests/e2e/browser-smoke.spec.ts --reporter=list` passed
  with 12 Chromium tests, including the public landing page mobile overflow
  check.
- `openspec validate --all --strict` passed with 21 items.
- `git diff --check` passed.
- Local desktop and mobile screenshots were inspected after fixing a dev-mode
  no-env blank screen; the public page renders without local Supabase browser
  env vars and sign-in actions report a configuration error instead of crashing.
- Separate verifier/reviewer sub-agents were not run in this turn because the
  available sub-agent tool is restricted to explicit user-requested delegation.
  This remains a process evidence gap before archive/production-readiness
  claims.


### 2026-07-09 — Demo video preparation package

**Human direction**

- Requested help preparing a 1-2 minute project demo video showing the product,
  screenshots, animation, and a short agentic development-process explanation.
- Clarified a preference for English narration, slides plus product screenshots,
  and optional AI voiceover tooling. Confirmed local secrets may be used without
  printing or inspecting secret values.

**AI contribution**

- Added `docs/demo-video/` with an animated static slide deck, English
  voiceover script, storyboard/recording checklist, deterministic Playwright
  screenshot capture script, and optional OpenAI TTS generator.
- Captured local fixture screenshots for the landing page, dashboard overview,
  digest feedback, delivery channels, and process-evidence slide assets.
- Kept the package self-contained and avoided committing secrets or production
  data. The user-added Playwright CLI skill remained untracked and was not
  committed by this stage.

**Verification performed**

- Built the browser app in e2e fixture mode.
- Ran `node docs/demo-video/capture-screenshots.mjs`; generated five 1440x960
  PNG assets.
- Rendered `docs/demo-video/index.html` through Playwright and confirmed the
  first slide loaded without console/page errors.
- Checked generated PNG dimensions with `identify docs/demo-video/assets/*.png`.
- Initial `node docs/demo-video/generate-voiceover.mjs` returned HTTP 401
  because a stale exported shell `OPENAI_API_KEY` differed from the working
  local `.env` key. The generator now prefers the repo `.env` value without
  printing secrets, and it generated `docs/demo-video/assets/voiceover.mp3`
  with an 80.856 second duration.


### 2026-07-09 — OpenSpec sync for landing, Telegram, and demo video

**Human direction**

- Requested committing the added Playwright CLI skills.
- Requested syncing existing OpenSpec change deltas into canonical specs and creating/syncing OpenSpec coverage for the demo-video generation work.

**AI contribution**

- Committed the added Playwright CLI skills under both `.agent/skills/playwright-cli/` and `.claude/skills/playwright-cli/`.
- Synced active OpenSpec deltas from `r-21-public-landing-vercel` into canonical `public-landing-page` and `deployment-bootstrap` specs.
- Synced active OpenSpec deltas from `r-telegram-chat-id-bot` into canonical `delivery-channels` and `deployment-bootstrap` specs.
- Created retrospective OpenSpec change `r-22-demo-video-package` with proposal, design, tasks, delta spec, and verification evidence.
- Synced `r-22-demo-video-package` into the new canonical `demo-video-package` spec.

**Verification performed**

- `openspec validate --all --strict` passed with 24 items.
- `npx prettier --check` passed for the touched OpenSpec and process files.


### 2026-07-09 — Demo video MP4 render

**Human direction**

- Asked whether the assistant could record the final demo video, possibly using Playwright CLI.

**AI contribution**

- Added `docs/demo-video/render-video.mjs` to render the static deck with Playwright and mux the generated voiceover with ffmpeg.
- Adjusted the renderer to use the available ffmpeg `mpeg4` encoder because the local ffmpeg build does not include `libx264`.
- Tuned final slide timing to preserve the full 80.856 second voiceover.
- Rendered `docs/demo-video/demo-video.mp4`.
- Updated the demo-video OpenSpec requirement, tasks, and verification evidence.

**Verification performed**

- `node --check docs/demo-video/render-video.mjs` passed.
- `node docs/demo-video/render-video.mjs` passed.
- `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 docs/demo-video/demo-video.mp4` reported `80.899000` seconds.


### 2026-07-09 — Landing page demo video embed

**Human direction**

- Asked to put the generated demo video somewhere on the landing page.

**AI contribution**

- Copied the rendered MP4 into `packages/browser/public/demo-video.mp4` so Vite/Vercel serve it from the browser app.
- Added a responsive public landing-page demo section below the workflow cards, preserving the first-viewport product hero and OAuth entry points.
- Added Playwright smoke coverage for the landing demo section and `/demo-video.mp4` response.
- Created and synced OpenSpec change `r-23-landing-demo-video` into `public-landing-page` and `demo-video-package` specs.

**Verification performed**

- `npm run build:browser` passed.
- `npx playwright test tests/e2e/browser-smoke.spec.ts --reporter=list` passed with 13 Chromium tests.
- `openspec validate --all --strict` passed with 25 items.
- `npx prettier --check` passed for touched browser, e2e, and OpenSpec files.
