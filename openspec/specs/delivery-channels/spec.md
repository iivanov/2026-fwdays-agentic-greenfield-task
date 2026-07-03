# delivery-channels Specification

## Purpose
TBD - created by archiving change r-10-delivery-channels. Update Purpose after archive.
## Requirements
### Requirement: Delivery Credentials Encryption at Rest
The system SHALL encrypt sensitive config parameters (like webhook URLs, bot tokens, Slack endpoints, and destination targets) at rest using AES-256-GCM (satisfies NFR-SEC-03).

#### Scenario: Encrypting Slack webhook URL on channel creation
- **WHEN** user submits a new Slack delivery channel with a target webhook URL
- **THEN** the system encrypts the webhook URL using AES-256-GCM before saving to database

### Requirement: SSRF Protection on Webhook Targets
The system SHALL validate the hostname and IP of any target URL provided for generic webhooks, blocking private, link-local, loopback, multicast, or reserved ranges (satisfies NFR-SEC-05).

#### Scenario: Rejecting generic webhook target resolving to localhost
- **WHEN** user submits a webhook target pointing to `http://127.0.0.1/notify`
- **THEN** the system blocks registration returning a `400 Bad Request`

### Requirement: HMAC-SHA256 Payload Signing Secrets
The system SHALL automatically generate a cryptographically secure 32-byte signing secret for generic webhooks to support HMAC-SHA256 delivery verification (satisfies NFR-SEC-04).

#### Scenario: Generating signing secret for generic webhooks
- **WHEN** user registers a generic webhook delivery channel
- **THEN** the system generates a signing secret and exposes it in the configuration body

### Requirement: Flow to Channel Mappings
The system SHALL support mapping multiple delivery channels to a processing flow in the `flow_delivery_channels` table (satisfies BR-DEL-06).

#### Scenario: Associating channel to flow
- **WHEN** user requests linking a channel ID to a flow ID via API
- **THEN** the system creates a link mapping and returns a `200` response

### Requirement: Delivery Management Panel
The dashboard client SHALL provide interactive tab panels for configuring, testing/verifying, linking, and removing delivery channels (satisfies BR-DEL-01, BR-DEL-02).

#### Scenario: Rendering the Delivery Channels settings
- **WHEN** the user navigates to the Delivery Channels dashboard tab
- **THEN** the system lists all active configurations, masking secret strings (e.g. `https://hooks.slack.com/services/****`)

