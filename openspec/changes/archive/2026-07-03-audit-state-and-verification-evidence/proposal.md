## Why

The repository marks R-01 through R-11 complete, but an independent audit found missing checker artifacts, unchecked archived tasks, absent Deno/Playwright gates, and implementation defects that contradict security and reliability requirements. The autonomous loop needs a truthful, machine-readable baseline before it can safely continue (`NFR-OPS-04`, `AT-01`, `AT-11`, `Q-01..Q-05`).

## What Changes

- Record the independent baseline verification and review findings without retroactively fabricating evidence.
- Canonicalize the roadmap path used by every automation entry point.
- Add dependency-ordered remediation slices for security, queue correctness, runtime verification, retention/RLS, and integration-test integrity before R-12 can complete.
- Correct `docs/state.md` so completed implementation is distinguished from independently verified completion.
- Define the evidence required for future roadmap slices to be marked done.
- Non-goals: repair production code, rewrite archived history, or claim unavailable hosted-provider evidence.

## Capabilities

### New Capabilities

- `verification-evidence-governance`: Truthful state tracking and durable verifier/reviewer evidence for autonomous changes.

### Modified Capabilities

<!-- No existing product capability requirements change. -->

## Impact

- Documentation/configuration: `docs/roadmap.md`, `docs/state.md`,
  `docs/development_process.md`, and the current-state context in
  `openspec/config.yaml`.
- Governance: root guidance, autonomous-operation rule, autopilot skill, and
  workflow now agree on mandatory checker evidence and applicable behavioral
  gates.
- OpenSpec: adds an audit change and explicit remediation backlog; archived artifacts remain immutable evidence of what actually happened.
- Workflow: future slices cannot be marked done without real static, behavioral, and independent review evidence.
