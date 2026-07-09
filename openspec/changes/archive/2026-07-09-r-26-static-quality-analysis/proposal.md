## Why

Recent refactors showed that large single-purpose files can grow unnoticed until maintenance becomes expensive. The repository already has ESLint, so adding complexity and size-oriented static analysis gives the project an inexpensive guardrail against future code-quality drift (`T-12`, `T-13`, `Q-01..Q-05`, `NFR-OPS-04`).

## What Changes

- Extend the existing root lint gate with maintainability rules for production TypeScript and Node scripts.
- Add Node global configuration for committed demo-video scripts so root lint reflects current runnable code instead of failing on environment globals.
- Keep thresholds conservative enough to pass the current refactored codebase while preventing new high-complexity functions and oversized files from landing unnoticed.
- Non-goals: new dependencies, broad code rewrites, CI workflow redesign, or changing runtime behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `cicd-security-gates`: Add static code-quality and complexity analysis to the committed lint gate.

## Impact

- Affected files: `eslint.config.js`, process/state docs, and OpenSpec change artifacts.
- No runtime application behavior, database schema, API behavior, dependency, or secret-handling changes.
- Verification uses `npm run lint`, focused ESLint invocations, formatting, OpenSpec validation, and whitespace checks.
