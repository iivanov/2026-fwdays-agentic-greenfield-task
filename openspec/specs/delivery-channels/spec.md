# delivery-channels Specification

## Purpose
Define secure delivery-channel configuration, verification, flow-channel mapping, and dashboard management behavior for in-app, email, Telegram, Slack, and generic signed webhook outputs.
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
The system SHALL automatically generate a cryptographically secure 32-byte signing secret for generic webhooks to support HMAC-SHA256 delivery verification, SHALL encrypt it at rest, and SHALL expose it only in the create/update response that first generates the secret (satisfies NFR-SEC-04).

#### Scenario: Generating signing secret for generic webhooks
- **WHEN** user registers a generic webhook delivery channel without an existing signing secret
- **THEN** the system generates a signing secret, stores it encrypted, and exposes it in that mutation response
- **AND** subsequent list, get, and flow-link responses mask the signing secret

#### Scenario: Preserving an existing webhook signing secret
- **WHEN** user updates a generic webhook channel URL without explicitly rotating credentials
- **THEN** the system preserves the existing signing secret and keeps it masked in the response

### Requirement: Delivery Channel Identity and Functional Verification
Delivery channels SHALL be bound to approved identities and SHALL only become active after type-appropriate verification (satisfies BR-DEL-02..05, A-05, A-06, NFR-SEC-03, NFR-SEC-04, NFR-SEC-06).

#### Scenario: Email destination is the verified account email
- **WHEN** an authenticated user creates or updates an email channel
- **THEN** the stored destination is derived from the user's verified identity email, not the request body
- **AND** unverified account email identities are rejected

#### Scenario: Telegram uses the application bot
- **WHEN** an authenticated user creates or updates a Telegram channel
- **THEN** the API rejects any user-supplied bot token and stores only the chat identifier

#### Scenario: Verification fails closed
- **WHEN** a user verifies a Telegram, Slack, or generic webhook channel and the provider or challenge check fails
- **THEN** the channel remains pending and the API returns a safe verification error

#### Scenario: Verification activates after proof
- **WHEN** a channel target passes its type-specific verification check
- **THEN** the API marks that user-owned channel active using a constrained server-side status transition

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

