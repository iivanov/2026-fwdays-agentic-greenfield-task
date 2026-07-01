---
description: Independent code review of the current change by a separate sub-agent (maker ≠ checker).
argument-hint: "[change name]"
---

# /review — independent code review (separate sub-agent)

Get an adversarial, independent review before archive/merge.

Target change: **$ARGUMENTS** (default: the active change).

## Steps
1. **Launch a separate sub-agent with the Agent tool** — a fresh context
   distinct from both the maker and the verifier
   (`.agent/rules/20-maker-checker.md`). Instruct it to run the
   **review-change** skill (it may also use the built-in `/code-review` skill).
   Pass it `git diff`, the change artifacts (`openspec show <name>`), and the
   cited requirement IDs — not the maker's summary.
2. It reviews against the checklist: requirements & scope; security (secrets,
   RLS/authz, encryption, SSRF, signing, validation); correctness & reliability
   (idempotency, ack-after-commit, retries → dead-letter, timeouts, leases);
   data lifecycle (7-day purge, ≤24h cache, ID-only queues); cost/constraints;
   tests; maintainability.
3. It returns **APPROVE / REQUEST CHANGES** with ranked findings (file:line —
   defect — failure scenario — fix), blocking vs. non-blocking.
4. **Act:** APPROVE (no unresolved blocking findings) → archive in `/dev-loop`.
   REQUEST CHANGES → return blocking findings to the maker; after the fix re-run
   **both** `/verify` and `/review` on the final diff.

## Guardrails
The reviewer inspects the code itself and reports findings; it does not
rubber-stamp and does not edit code. This in-loop review is additional to
external PR review (CodeRabbit/human), not a replacement.
