## Context

The current branch contains the source remediation but its PR remains blocked
because GitGuardian evaluates individual historical commits. The affected JWT
is the deterministic local Supabase test fixture, not a hosted credential.

## Goals / Non-Goals

**Goals:** Remove the literal from all commits reachable from the fork's public
`main`, preserve the final application tree, and update PR #47 safely.

**Non-Goals:** Rewrite other fork branches/tags, rotate hosted credentials, or
include unrelated local work in the force-push.

## Decisions

1. Perform the rewrite in a fresh single-branch temporary clone. This isolates
   the operation from the shared worktree and unrelated work.
2. Derive the replacement token from the known historical file without logging
   it, then replace exact occurrences with `local-service-role-fixture` using
   `git filter-branch` and a temporary untracked script.
3. Compare trees before adding process documentation; the rewritten current
   application tree must equal the captured original tree.
4. Push only `main` with `--force-with-lease` pinned to the original remote
   SHA. Any lease failure stops the operation.

## Risks / Trade-offs

- [Concurrent main update] -> The pinned lease rejects the push; re-clone and
  re-plan from the new head.
- [Historic test behavior changes] -> Only the secret fixture is redacted in
  old commits; the current tree is asserted identical before documentation.
- [GitGuardian retains a prior PR object] -> Stop after local proof and report
  the retained incident rather than rewriting additional refs.
