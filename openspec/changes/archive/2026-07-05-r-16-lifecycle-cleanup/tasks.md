## 1. Lifecycle Evidence

- [x] 1.1 Audit existing cleanup, queue, and schedule implementation against
  R-16 requirements and identify any missing executable evidence.
- [x] 1.2 Add lightweight regression tests for cleanup cadence, lease recovery,
  content purge, dead-letter surfacing, and durable cache posture where current
  tests do not already prove the requirement.

## 2. Documentation

- [x] 2.1 Update `docs/state.md`, `docs/roadmap.md`, and
  `docs/development_process.md` with R-16 progress and evidence.

## 3. Verification

- [x] 3.1 Run focused lifecycle tests plus relevant local gates, including
  OpenSpec strict validation and `git diff --check`.
- [x] 3.2 Run independent verifier and reviewer sub-agents on the final diff,
  fix blocking findings, rerun both checker passes, then archive and commit.
