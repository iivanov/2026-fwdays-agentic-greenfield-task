# Repository Agent Guidance

## General

Track your current state in the ./docs/state.md
Commit each stage.
Work directly on `main`; do not create feature branches unless the human asks.

## Scope

This file applies to the entire repository. Add a nested `AGENTS.md` only when a subtree needs additional rules; closer guidance may refine this file for that subtree.

## Sources of Truth

- Follow the documentation decision strategy in `docs/README.md`.
- Preserve the dependency direction: business requirements and NFRs → data → application architecture/tactics/quality → technology trade-offs → hosting.
- Update the owning upstream layer first when a decision changes, then propagate it through downstream traceability.
- Do not introduce product behavior in data, application, technology, or hosting documents without a supporting business requirement.

## Working Agreement

- Inspect `git status` before editing and preserve unrelated user changes.
- Develop on `main` for this single-developer repository; avoid creating
  feature branches unless the human explicitly requests one.
- Use official, current sources for provider limits, pricing, security behavior, and product capabilities; record verification dates in technology documents.
- Keep technology names out of business, data, and application architecture documents unless the name is itself an approved product constraint.
- Never commit secrets, production data, `.env` values, provider state, database dumps, or generated private configuration.
- Prefer maintained open-source tools and no-cost public-repository GitHub capabilities where they satisfy the requirements.
- Use `docs/DESIGN.md` and the stitch MCP server for UI design and implementation.

## Development Loop (Agentic)

This project is built by an agent loop, not step-by-step hand-prompting. The
loop is **spec-driven** (OpenSpec) and enforces **maker ≠ checker**: the agent
that writes a change never certifies its own work.

- **Spec engine:** OpenSpec (`schema: spec-driven`). Project context and
  per-artifact rules live in `openspec/config.yaml`; changes live in
  `openspec/changes/`, canonical specs in `openspec/specs/`. Every change traces
  to upstream IDs (`BR-*`, `NFR-*`, `D-*`, `A-*`, `AT-*`, `Q-*`, `T-*`, `H-*`).
- **The cycle (one change at a time):**
  `plan → implement (maker) → verify (sub-agent) → review (sub-agent) → archive`.
  Verify must be green AND review must have no unresolved blocking findings
  before archive. On failure, findings go back to the maker and **both** checker
  passes re-run on the final diff.
- **Maker ≠ checker:** implementation, verification, and review are three
  distinct sub-agents in fresh contexts. Verify runs the real gates and observes
  behavior; review is an independent, adversarial code review. A maker's
  self-review and external PR review (CodeRabbit) are _additional_ layers, never
  substitutes for the two in-loop checker sub-agents.
- **Roles (skills, canonical in `.agent/skills/`; `.claude/skills/` symlinks to
  the role skills):** `decompose-requirements` (planner), `implement-change`
  (maker), `verify-change` (checker — static gates), `verify-e2e` (checker —
  Playwright behavior + artifact), `review-change` (checker — independent review).
- **Binding rules (`.agent/rules/`):** `10-spec-driven`, `20-maker-checker`,
  `30-verification-gates`, `40-security-and-secrets`, `50-autonomous-operation`.
  They apply to all agent work in this repo.
- **Entry points (slash commands):** `/dev-loop` (supervised orchestrator),
  `/autopilot` (unattended build loop), `/decompose` (build the backlog),
  `/plan`, `/verify`, `/review`, plus OpenSpec's `/opsx:propose`, `/opsx:apply`,
  `/opsx:archive`, `/opsx:explore`, `/opsx:sync`. Configured for **Antigravity**
  (`.agent/workflows/`) and **Claude Code** (`.claude/commands/`).
- Run `openspec update` after upgrading the OpenSpec CLI to refresh the
  generated skills/commands; it does not touch the custom role skills or rules.

### Autonomous mode (`/autopilot`)

`/autopilot` runs the whole loop unattended: it decomposes requirements into an
ordered backlog (`docs/roadmap.md`), then builds each slice with the same
spec-driven, maker≠checker cycle — including a hard verification gate of static
checks (`verify-change`) plus applicable behavioral verification. UI/API/runtime
changes use Playwright (`verify-e2e`); documentation-only changes use their
documentation gates and record behavioral verification as not applicable. Every
change retains `openspec/changes/<name>/verification.md` and an independent
review report before archive. The loop then moves to the next slice until the
project is done and decides from the architecture docs instead of prompting
(`.agent/rules/50-autonomous-operation`).

What it does **not** do without an explicit human go-ahead (by design): push to origin, deploy, spend money, or create external accounts. It works directly on the `main` branch, commits locally, and collects
account/secret/deploy needs under "Human bootstrap required" in
`docs/roadmap.md`. It stops and reports when everything left is blocked, a
human-bootstrap item is required, or a slice fails verification 3 times.
Progress state is the roadmap statuses + OpenSpec changes + git, so `/autopilot`
is resumable — re-running continues from the next `pending` slice.

### Installed technology skills (third-party, trusted sources)

Stack-specific know-how is provided by first-party skills installed with the
`skills` CLI (`vercel-labs/skills`) into the canonical `.agent/skills/`
(project scope, `--copy` so they are committed and self-contained). Provenance
and content-integrity hashes are pinned in `skills-lock.json`; update with
`npx skills update`.

| Skill                              | Source                             | License    | Why                                                                                                                  |
| ---------------------------------- | ---------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `supabase`                         | `supabase/agent-skills` (official) | MIT        | Database, Auth, Edge Functions, RLS, Queues, Cron, `supabase-js`, migrations — our whole backend (`T-03/T-05/T-06`). |
| `supabase-postgres-best-practices` | `supabase/agent-skills` (official) | MIT        | Postgres query/schema/index/RLS optimization for the data layer (`D-*`).                                             |
| `webapp-testing`                   | `anthropics/skills` (official)     | Apache-2.0 | Playwright web-app testing (`T-12` e2e). Ships Python helper scripts.                                                |
| `frontend-design`                  | `anthropics/skills` (official)     | Apache-2.0 | Visual/UX guidance for the React frontend (`T-02`).                                                                  |
| `skill-creator`                    | `anthropics/skills` (official)     | Apache-2.0 | Authoring/evaluating new project skills in the loop. Ships Python scripts.                                           |

- Only first-party/vendor-official skills are used; community skill aggregators
  are intentionally avoided. Third-party skills run with full agent permissions
  — review a skill (and its scripts) before trusting it, and re-check
  `skills-lock.json` hashes after updates.
- These skills are _how-to_ knowledge; they do not override the binding
  `.agent/rules/` (policy) — on any conflict, the rules win.
- For libraries without a trusted skill (React, Vite, TanStack Query, OpenAI
  Responses API, Brevo), use the **context7 MCP** for live version-accurate docs
  rather than an untrusted skill.
- `.agents/` (plural) is a symlink to `.agent/` (singular) so the OpenSpec CLI
  (writes `.agent/`) and the `skills` CLI (writes `.agents/`) share one real
  directory; Antigravity reads either name.

## Development Process Record

- Update `docs/development_process.md` after every material feature, architecture decision, tooling change, verification loop, or human correction.
- Record what actually happened: human decisions, agent contribution, evidence checked, files changed, verification run, findings, and unresolved work.
- Distinguish completed work from planned work. Do not describe proposed CI, tests, infrastructure, deployments, or independent reviews as already implemented.
- Keep the record concise and append/update milestones instead of inventing a polished history after the fact.

## Verification

- For documentation changes, run `git diff --check`, validate local links/paths, and check requirement/decision traceability and stale terminology.
- For code or infrastructure changes, run the narrowest relevant formatter, lint, type, test, security, migration, and IaC validation commands defined by the repository. Report exactly which checks ran.
- Runnable project gates (run from workspace root):
  - Strict Typecheck: `npm run typecheck`
  - Lint: `npm run lint`
  - Format Check: `npm run format`
  - Unit Tests: `npm run test`
  - Backend/API Coverage: `npm run test:coverage`
  - Supabase Integration Tests: `npm run test:integration` (requires local
    Supabase stack: `npm run supabase:start` and `npm run supabase:reset`; fails
    visibly when unavailable)
  - Browser Build: `npm run build:browser`
  - Browser Smoke E2E: `npm run test:e2e`
  - Deno Edge Check: `npm run deno:check`
  - Deno Edge Lint: `npm run deno:lint`
  - Deno Edge Format Check: `npm run deno:fmt`
  - Deno Edge Lock Integrity: `npm run deno:lock`
  - Deno Edge Dependency Audit: `npm run deno:audit`
  - npm Dependency Audit: `npm audit`
  - Supabase Migration Lint: `npm run supabase:lint` (requires local Supabase)
  - Combined local non-integration gate: `npm run verify:local`
- Every material change requires separate verifier and reviewer passes on the
  final diff. A maker's self-review is useful but is not evidence of independent
  verification or review.

## Change Handoff

- Summarize the outcome first.
- Link changed files and identify remaining risks or decisions.
- Never claim production readiness from documentation review alone.
