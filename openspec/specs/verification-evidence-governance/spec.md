# verification-evidence-governance Specification

## Purpose

Define truthful autonomous-build state and durable independent checker evidence
so implementation commits are never presented as verified completion without
the applicable gates and final-diff review required by `NFR-OPS-04`, `AT-01`,
`AT-11`, and `Q-01..Q-05`.

## Requirements

### Requirement: Truthful completion state
The autonomous backlog and state record SHALL distinguish implementation commits from independently verified completion, as required by `NFR-OPS-04`, `AT-01`, and `Q-01..Q-05`.

#### Scenario: Audit contradicts a done claim
- **WHEN** independent evidence shows that a completed slice lacks required checks or behavior
- **THEN** the state record SHALL describe the contradiction and the roadmap SHALL schedule remediation before dependent feature work

### Requirement: Durable checker evidence
Every material change SHALL retain separate verifier and reviewer reports that identify the final diff, exact gates, behavioral scenarios, findings, and dispositions before archive (`AT-11`, `Q-01..Q-05`).

#### Scenario: Checker evidence is missing
- **WHEN** a change has no durable verifier or reviewer report
- **THEN** the change SHALL NOT be used as evidence that maker/checker or behavioral verification completed

#### Scenario: Final diff changes after checking
- **WHEN** the maker modifies a change after verification or review
- **THEN** both independent checker passes SHALL run again against the final diff

### Requirement: Real gates do not silently skip
Required integration and behavioral gates SHALL fail or report `not run` when their runtime prerequisite is unavailable; they MUST NOT return a passing result without exercising the required behavior (`Q-01`, `Q-03`, `Q-04`).

#### Scenario: Database emulator unavailable
- **WHEN** a required database integration suite cannot connect to the local stack
- **THEN** the gate SHALL fail or be explicitly reported as not run rather than returning a passing test

### Requirement: Canonical autonomous state path
Autonomous workflows SHALL read and update one case-correct canonical roadmap path (`AT-01`).

#### Scenario: Run on a case-sensitive filesystem
- **WHEN** the autonomous loop starts on a case-sensitive filesystem
- **THEN** it SHALL locate `docs/roadmap.md` without relying on an alternate filename casing
