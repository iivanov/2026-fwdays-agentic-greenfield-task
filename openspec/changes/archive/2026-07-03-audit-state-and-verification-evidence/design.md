## Context

The independent verifier and reviewer found that the current `done` labels describe implementation commits, not auditable completion. Eleven archived changes have no committed verifier/reviewer artifacts, all canonical spec purposes are placeholders, R-11 was archived with unchecked tasks, and required Deno and Playwright gates do not exist. The audit also found concrete security, authorization, retention, SSRF, ingestion, and queue-acknowledgement defects.

## Goals / Non-Goals

**Goals:**

- Preserve the historical artifacts as evidence rather than editing them to imply checks that did not occur.
- Make current state and roadmap dependencies match observed evidence.
- Define a durable evidence contract derived from `NFR-OPS-04`, `AT-01`, `AT-11`, and `Q-01..Q-05`.
- Split remediation into independently verifiable OpenSpec changes before pipeline work continues.

**Non-Goals:**

- Repair application code in this documentation-only change.
- Certify R-01..R-11 retroactively.
- Verify hosted GitHub/Supabase/Vercel settings without account access.

## Decisions

1. **Keep historical archives immutable.** Editing old task lists or inventing reports would destroy the evidence of what actually happened. New remediation changes will supersede defective behavior.
2. **Use the lowercase roadmap path.** All workflows and guidance already reference `docs/roadmap.md`; renaming the existing uppercase file fixes case-sensitive execution without maintaining duplicate state.
3. **Distinguish implemented from verified.** The roadmap retains historical `done` rows but adds explicit audit debt and makes future work depend on its remediation. `docs/state.md` records that prior completion claims are provisional until corrective slices pass.
4. **Commit checker evidence per change.** Each material slice must contain `verification.md` and `review.md` with exact commands, behavioral evidence, findings, and disposition before archive.
5. **Do not use a narrow green gate as broad proof.** Database tests that skip when the emulator is absent, browser-unit tests that import Edge code without Deno checks, and local-only checks cannot certify broader requirements.

## Risks / Trade-offs

- **[Risk] Historical rows still read `done`.** → Mitigation: add a prominent audit status and remediation dependency phase; never use those rows as current verification evidence.
- **[Risk] Remediation delays feature delivery.** → Mitigation: keep each correction small and dependency ordered; security and durable-work correctness are release blockers.
- **[Risk] Hosted controls remain unverified locally.** → Mitigation: list exact human-bootstrap audit actions and do not claim them complete.
