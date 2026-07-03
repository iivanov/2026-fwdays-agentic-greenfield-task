## MODIFIED Requirements

### Requirement: Delivery Credentials Encryption at Rest
The system SHALL encrypt sensitive config parameters at rest and SHALL expose generic webhook signing secrets only in the create/update response that first generates the secret.

#### Scenario: One-time webhook signing secret disclosure
- **WHEN** a user creates a generic webhook channel without providing a signing secret
- **THEN** the API generates a secret, stores it encrypted, and returns it in that mutation response
- **AND** subsequent list/get/link responses mask the signing secret.

### Requirement: Delivery Channel Identity and Functional Verification
Delivery channels SHALL be bound to approved identities and SHALL only become active after type-appropriate verification.

#### Scenario: Email destination is the verified account email
- **WHEN** an authenticated user creates or updates an email channel
- **THEN** the stored destination is derived from the user's verified identity email, not the request body.

#### Scenario: Telegram uses the application bot
- **WHEN** an authenticated user creates or updates a Telegram channel
- **THEN** the API rejects any user-supplied bot token and stores only the chat identifier.

#### Scenario: Verification fails closed
- **WHEN** a user verifies a Telegram, Slack, or generic webhook channel and the provider/challenge check fails
- **THEN** the channel remains pending and the API returns a safe verification error.
