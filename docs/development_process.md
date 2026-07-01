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

## 6. Definition of Done for Future Changes

A change is complete only when:

- its upstream requirement/decision is explicit;
- downstream data, architecture, tactics, technology, hosting, and quality impacts are updated;
- implementation and tests exist when the task includes implementation;
- relevant formatter, lint, type, test, security, migration, and IaC checks pass;
- a separate checker reviews material risk when available;
- remaining risks and unimplemented work are stated;
- this process record is updated when the change is material.
