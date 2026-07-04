# verification-evidence-governance Delta

## ADDED Requirements

### Requirement: Canonical specs MUST have meaningful purposes

Every canonical OpenSpec spec MUST define a non-placeholder `Purpose` section
that summarizes the spec's ownership boundary and preserves upstream
traceability (`AT-01`, `AT-11`, `Q-01`, `Q-02`, `NFR-OPS-04`).

#### Scenario: Generated placeholder purpose remains

- **WHEN** a canonical spec contains a generated `TBD` archive placeholder
- **THEN** the hygiene gate fails before the change can be considered complete

### Requirement: New archives MUST retain complete checker evidence

Every non-legacy archived OpenSpec change MUST retain complete tasks plus
separate `verification.md` and `review.md` reports before archive (`AT-11`,
`Q-01`, `Q-05`, `NFR-OPS-04`).

#### Scenario: Archive lacks reviewer evidence

- **WHEN** a non-legacy archived change is missing `review.md`
- **THEN** the hygiene gate fails

#### Scenario: Archive leaves tasks unchecked

- **WHEN** a non-legacy archived change has unchecked task-list items
- **THEN** the hygiene gate fails

### Requirement: Legacy evidence gaps MUST stay explicit

Pre-audit archives that lack complete checker evidence SHALL remain documented
as legacy evidence gaps and MUST NOT be silently upgraded into verified
completion (`AT-01`, `AT-11`, `Q-01`, `NFR-OPS-04`).

#### Scenario: Historical archive lacks checker artifacts

- **WHEN** a pre-audit archive lacks verifier or reviewer reports
- **THEN** current state documentation identifies it as insufficient checker
  proof instead of treating it as completed verification
