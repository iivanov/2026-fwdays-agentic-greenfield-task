## ADDED Requirements

### Requirement: SSRF Outbound URL Validation
The system SHALL validate all user-provided source and webhook URLs against SSRF vulnerabilities (satisfies NFR-SEC-05). It MUST enforce HTTP/HTTPS protocols and ensure that hostnames do not resolve to private, loopback, link-local, multicast, or reserved networks.

#### Scenario: Block loopback and metadata addresses
- **WHEN** user submits a source URL like `http://127.0.0.1/feed` or `http://169.254.169.254/metadata`
- **THEN** the system rejects the request with a 400 status code and returns an SSRF validation error

#### Scenario: Accept public internet hostnames
- **WHEN** user submits a source URL like `https://news.ycombinator.com/rss` resolving to a public IP
- **THEN** the system accepts the URL and completes validation

### Requirement: Link Ingestion Source to Flow
The API edge function SHALL allow authenticated users to connect validated news feeds to their owned flows (satisfies BR-SRC-01, BR-SRC-02, BR-SRC-03).

#### Scenario: Successfully connect a new feed
- **WHEN** user makes a POST request to `/sources` containing a safe URL, type, and valid owned `flow_id`
- **THEN** the system creates or retrieves the unique global source record, links it to the flow, and returns a 201 response

#### Scenario: Disconnect a feed from flow
- **WHEN** user makes a DELETE request to `/sources` containing `flow_id` and `source_id`
- **THEN** the system removes the connection and returns a 200 response

### Requirement: Source Management Panel
The dashboard UI SHALL allow users to select flows, add format-typed URLs, and disconnect links (satisfies NFR-UX-01).

#### Scenario: Interacting with the Sources Panel
- **WHEN** user configures settings and links a new feed
- **THEN** the API POST endpoint is called and the connected sources list refreshes dynamically
