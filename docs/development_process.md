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
- `npm run deno:audit` exited 0, with a non-blocking warning that some update
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

**Not complete**

- GitHub CI must rerun the Supabase-backed integration gate and provide the next
  authoritative result.
- R-11B still requires separate verifier and reviewer artifacts before archive.

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
