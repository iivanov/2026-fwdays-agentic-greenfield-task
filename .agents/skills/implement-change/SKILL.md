---
name: implement-change
description: MAKER role. Implement one approved OpenSpec change end-to-end for the news-aggregator, following the selected stack, security defaults, and tests-with-code. Use when starting or continuing implementation of a change. Does NOT verify or review its own work — hand off to separate sub-agents.
metadata:
  role: maker
  version: "1.0"
---

# Skill: Implement a change (Maker)

## Objective

Turn one **approved** OpenSpec change into working, tested code and
configuration for the AI-Powered Personalized News Aggregator — correct,
secure, and traceable to requirements. You produce the change and its own
verification evidence, but you **do not** certify it: verification and review
are done by separate sub-agents (see `.agent/rules/20-maker-checker.md`).

## Rules of engagement

- Read first: the change's `proposal.md`, `specs`, `design.md`, `tasks.md`, the
  cited upstream docs in `docs/architecture/`, and `openspec/config.yaml`.
- Stay inside the approved scope and the selected stack (TypeScript, React+Vite,
  Supabase, `pgmq`/`pg_cron`, OpenAI Responses API, Brevo, Web Crypto). Do not
  add a new technology or product behavior — if you find a gap, stop and fix the
  owning upstream doc via a new proposal.
- Honor all four project rules: spec-driven, maker≠checker, verification-gates,
  security-and-secrets. Never commit secrets or `.env` values.
- Tests are part of implementation, not a follow-up: write unit/integration
  tests **with** the code (concurrency, retry, idempotency, and error/abuse
  paths — not just the happy path).
- Prefer the smallest coherent diff. Keep `git status` clean of unrelated edits.

## Instructions

1. **Load context.** Run `openspec status --change "<name>" --json` and
   `openspec show <name>`. Read the change artifacts and the cited requirement
   IDs. Restate the acceptance criteria before writing code.
2. **Implement task by task** (`/opsx:apply` drives this). For each task in
   `tasks.md`:
   - Make the change following `design.md` and the architecture tactics
     (idempotent handlers + domain idempotency key; ack after DB commit; bounded
     retries → dead-letter; 30s timeouts; RLS + deny-by-default; Zod at the
     boundary; encrypt sensitive config; SSRF checks on user URLs; ID-only queue
     payloads; structured logs without content/credentials).
   - Add/adjust tests for that task.
   - Check the box in `tasks.md` only when the task is truly done.
3. **Scaffolding note.** If a needed gate/tool does not exist yet, create it as
   part of the change (e.g. add the npm workspace, Vitest, ESLint, `tsc`,
   `supabase init`) and add the new runnable gate to the **Verification**
   section of `AGENTS.md`.
4. **Self-check (not a substitute for the checkers).** Run the narrow gates you
   can (`tsc`, lint, the tests you touched) and fix obvious issues. Record what
   you ran.
5. **Hand off.** Produce a short maker summary: what changed, files touched,
   requirement IDs satisfied, tests added, gates you ran, and known risks /
   open questions. Then stop and let the loop spawn the **verifier** and
   **reviewer** sub-agents. Do not self-approve.

## Output

- Updated code/config/tests and an updated `tasks.md`.
- A maker handoff summary (changed files, IDs satisfied, tests, self-run gates,
  risks). Explicitly state: "Ready for independent verify + review."
