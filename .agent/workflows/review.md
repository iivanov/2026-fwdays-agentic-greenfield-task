---
description: Independent code review of the current change by a separate sub-agent (maker ≠ checker).
---

# /review — independent code review (separate sub-agent)

Get an adversarial, independent review of a change before archive/merge.
**Spawn a new sub-agent in a fresh context** so the reviewer is separate from
both the maker and the verifier (`.agent/rules/20-maker-checker.md`).

**Input (optional):** a change name. Default to the active change.

## Steps

1. **Spawn a reviewer sub-agent.** Instruct it to run the **review-change**
   skill. Give it the diff (`git diff`), the change artifacts
   (`openspec show <name>`), and the cited requirement IDs — not the maker's
   summary.
2. The sub-agent reviews against the checklist in the skill: requirements &
   scope, security (secrets, RLS/authz, encryption, SSRF, signing, validation),
   correctness & reliability (idempotency, ack-after-commit, retries →
   dead-letter, timeouts, leases), data lifecycle (7-day purge, ≤24h cache,
   ID-only queues), cost/constraints, tests, and maintainability.
3. It returns **APPROVE / REQUEST CHANGES** with ranked findings
   (file:line — defect — failure scenario — fix), blocking vs. non-blocking.
4. **Act on the verdict.**
   - APPROVE (no unresolved blocking findings) → proceed to archive in
     `/dev-loop`.
   - REQUEST CHANGES → return blocking findings to the maker; after the fix,
     re-run **both** `/verify` and `/review` on the final diff.

## Guardrails

- The reviewer inspects the code itself; it does not rubber-stamp the maker or
  the verifier. It reports findings; it does not edit code.
- This in-loop review is in addition to external PR review (CodeRabbit/human),
  not a replacement for it.
