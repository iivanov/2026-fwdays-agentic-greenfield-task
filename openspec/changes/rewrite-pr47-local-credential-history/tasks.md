## 1. Plan and isolate

- [x] 1.1 Capture the PR source SHA and create a clean single-branch rewrite
  clone without touching shared work.
- [x] 1.2 Create and commit the OpenSpec plan for the targeted rewrite.

## 2. Rewrite and verify

- [x] 2.1 Rewrite only the temporary clone's `main` history with an exact,
  non-logging replacement of the local fixture.
- [x] 2.2 Verify the current tree is unchanged before process documentation and
  that the literal is absent from all rewritten reachable commits.
- [ ] 2.3 Record the rewrite, run applicable checks, and obtain independent
  verifier and security-reviewer reports.

## 3. Publish

- [ ] 3.1 Force-push only the rewritten `main` with a captured-SHA lease.
- [ ] 3.2 Confirm PR #47's refreshed GitGuardian result and archive the change.
