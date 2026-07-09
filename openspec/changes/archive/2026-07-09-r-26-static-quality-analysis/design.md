## Context

The codebase already uses ESLint as the root lint gate, but it currently focuses on baseline recommended rules. Root lint also fails on committed Node scripts in `docs/demo-video/*.mjs` because those scripts are not covered by the existing Node global override. After the worker/API helper decomposition, adding lightweight complexity controls to ESLint is the least disruptive way to prevent a repeat of oversized, high-complexity modules.

## Goals / Non-Goals

**Goals:**

- Make `npm run lint` pass for the current committed codebase.
- Add ESLint rules that cap cyclomatic complexity, nesting depth, callback nesting, parameter count, and file length for production code.
- Apply Node globals consistently to `infra/scripts/**/*.mjs` and `docs/demo-video/**/*.mjs`.
- Exclude generated/build artifacts, tests, and OpenSpec/docs prose from complexity thresholds.

**Non-Goals:**

- No new npm dependency or package manager change.
- No runtime code refactor beyond ESLint configuration.
- No CI workflow restructuring; the existing `npm run lint` gate remains the integration point.

## Decisions

- Use ESLint core rules instead of a new analyzer dependency. This keeps the gate cheap, already available, and compatible with existing `npm run lint`.
- Apply complexity rules to source/script files and exclude tests. Test files intentionally contain setup-heavy cases that should not drive production complexity thresholds.
- Use conservative default thresholds: `complexity <= 40`, `max-depth <= 4`, `max-nested-callbacks <= 4`, `max-params <= 6`, and `max-lines <= 1000` for production source/script files. These thresholds pass the current refactored code and catch future regressions before files grow beyond the current post-refactor baseline.
- Keep explicit baseline overrides for known remaining orchestrator hotspots (`api/router.ts`, `work/handler.ts`, `api/ssrf.ts`, and `work/logging.ts`) so the gate can land now while still preventing those modules from silently becoming more complex.

## Risks / Trade-offs

- Thresholds may need tightening later as modules mature -> start conservative and ratchet down after more decomposition.
- File-length gates can be noisy for test files -> exclude tests and use coverage/review for test quality instead.
- Root lint could expose unrelated lint debt -> fix environment classification for committed Node scripts so the gate reflects actual issues.
