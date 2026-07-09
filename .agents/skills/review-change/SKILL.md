---
name: review-change
description: REVIEWER / CHECKER role, run by a sub-agent separate from the maker. Independently review a change's diff against requirements, security, correctness, and the project rules, then report ranked findings. Use for code review before archive/merge. Does not fix code.
metadata:
  role: checker
  version: "1.0"
---

# Skill: Review a change (independent Reviewer)

## Objective

Independently review a change as an adversarial reviewer: does the diff
correctly and safely satisfy the requirements it claims, without regressions or
rule violations? You are a separate sub-agent from the maker
(`.agent/rules/20-maker-checker.md`). You report ranked findings; you do not
edit code.

## Rules of engagement

- Assume the change is wrong until the diff proves otherwise. Read the actual
  code, not the maker's summary.
- Review against the cited requirement IDs and the four project rules
  (spec-driven, maker≠checker, verification-gates, security-and-secrets).
- Distinguish **blocking** findings (must fix before archive) from
  **non-blocking** (nice-to-have / documented-disposition). Be specific:
  file:line, the concrete failure scenario, and the fix direction.

## Review checklist

1. **Requirements & scope.** Every acceptance criterion met? Traces to the
   claimed `BR-*/NFR-*/...` IDs? No scope creep, no undocumented product
   behavior, no silent upstream-decision change?
2. **Security (highest priority).** Secrets/`.env`/state not committed and not
   logged. Deny-by-default authz + RLS on user-owned tables; user id from JWT
   not body. Sensitive config encrypted at rest. SSRF checks on user URLs +
   redirect re-validation. Webhook signing + stable event id. Zod validation at
   boundaries. Least-privilege worker roles.
3. **Correctness & reliability.** Idempotent handlers with a domain idempotency
   key; ack only after DB commit; bounded retries → dead-letter +
   `OperationalEvent`; 30s timeouts; lease recovery. Edge cases and error paths
   handled, not just the happy path.
4. **Data lifecycle.** 7-day purge, ≤24h cache, ID-only queue payloads
   respected. Retention not weakened.
5. **Cost/constraints.** Stays within $0 free-tier posture; AI input truncation
   before the call; ≤5 flows/user; 1 run/flow/day; only `gpt-5.4-mini`.
6. **Tests.** Do the tests actually cover the new behavior and its failure
   modes? Any assertion-free or tautological tests? Coverage direction toward
   the ≥80% backend target?
7. **Maintainability.** Clear names, adapter boundaries kept, complex AI/
   extraction logic commented, structured logs with correlation ids and no
   sensitive content.

## Output

A reviewer report:
- **Verdict:** APPROVE / REQUEST CHANGES.
- **Blocking findings** (ranked, most severe first): file:line — defect —
  failure scenario — suggested fix.
- **Non-blocking findings**: same shape, plus recommended disposition.
- Note where you relied on the verifier's evidence vs. inspected yourself.
