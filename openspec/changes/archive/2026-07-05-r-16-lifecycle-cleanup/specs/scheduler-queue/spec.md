## MODIFIED Requirements

### Requirement: Maintenance Cleanup Loop

The system SHALL run a cleanup loop every 30 minutes to recover expired
source-fetch, processing, and delivery leases older than five minutes, and to
permanently delete content-bearing articles, digests, and delivery attempts
older than seven days while retaining only sanitized metadata according to its
longer lifecycle.

#### Scenario: Recovering expired leases and purging old assets

- **WHEN** the `cleanup` function executes
- **THEN** it resets abandoned source-fetch, processing, and delivery leases
- **AND** it purges content-bearing article, digest, and delivery-attempt rows
  older than seven days
- **AND** it does not delete unresolved operational failures solely because of
  age
