## ADDED Requirements

### Requirement: Static analysis MUST control production code complexity
The repository lint gate SHALL include static analysis rules that limit production code complexity and file size without adding new dependencies (`T-12`, `T-13`, `Q-01..Q-05`, `NFR-OPS-04`).

#### Scenario: Root lint catches complexity regressions
- **WHEN** `npm run lint` is executed from the repository root
- **THEN** ESLint checks production TypeScript and Node script files for configured complexity, nesting, parameter-count, and file-size limits

#### Scenario: Node script linting uses the correct runtime globals
- **WHEN** committed Node `.mjs` scripts under infrastructure or documentation tooling are linted
- **THEN** ESLint recognizes Node runtime globals such as `process`, `console`, `Buffer`, `fetch`, and `URL`
