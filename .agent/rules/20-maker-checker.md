---
trigger: always_on
description: Maker never checks its own work; verify and review run as separate sub-agents.
---

# Rule: Maker ≠ Checker

The agent that writes a change is the **maker**. The maker must not be the one
who certifies that the change is correct. Independent checking is a separate
step performed by separate sub-agents.

## Always

- After the maker finishes implementing (`/opsx:apply` via the `implement-change`
  skill), spawn **two separate sub-agents**:
  1. a **verifier** sub-agent that runs the `verify-change` skill (executes the
     real gates and observes behavior), and
  2. a **reviewer** sub-agent that runs the `review-change` skill (independent
     code review against requirements and security).
- Give each sub-agent only the diff/change under review and the acceptance
  criteria — not the maker's self-assessment. A checker starts from "prove this
  is wrong," not "confirm the maker is right."
- The maker fixes issues the checkers raise, then re-runs verify **and** review
  (they must pass on the final diff, not an earlier one).
- A change is done only when: verify is green, review has no unresolved blocking
  findings, and any accepted lower-severity findings are documented.

## Never

- Never let the maker's own self-review substitute for the checker pass — it is
  useful but is not evidence of independent review.
- Never mark a change verified/approved without a distinct checker artifact
  (verifier report + reviewer report).
- Never skip the reviewer for "small" security-, migration-, auth-, delivery-,
  or retention-relevant changes.

External PR review (CodeRabbit, human) is an *additional* layer, not a
replacement for the in-loop reviewer sub-agent. See `/dev-loop`, `/verify`,
`/review`.
