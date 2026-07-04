# flow-management Specification

## Purpose
Define user-owned processing flow lifecycle behavior, quotas, scheduling
defaults, enabled state, and prompt configuration boundaries (`BR-FLOW-01`,
`BR-FLOW-07`, `BR-USER-03`, `NFR-CON-01`).
## Requirements
### Requirement: Flow CRUD Operations
The system SHALL expose RESTful API endpoints for creating, reading, updating, and deleting processing flows owned by the authenticated user (satisfies BR-FLOW-01, BR-FLOW-07).

#### Scenario: Creating a valid flow
- **WHEN** user makes a POST to `/flows` specifying `name` and `prompt_type`
- **THEN** the system inserts the flow, default schedules it to run next at 06:00 UTC, and returns a 201 response

#### Scenario: Enforcing the 5-flow quota limit
- **WHEN** user already owns 5 flows and attempts to create a 6th flow
- **THEN** the API returns a 400 response with a clear quota limit validation error message

#### Scenario: Toggling flow enabled state
- **WHEN** user makes a PUT to `/flows/:id` specifying `is_enabled: false`
- **THEN** the system updates the flow's enabled state and returns a 200 response

### Requirement: Prompt Customization
The system SHALL support both predefined briefing formats and custom instruction prompt templates for each flow, with custom prompt templates encrypted at rest and decrypted only after authenticated owner authorization (satisfies BR-FLOW-07, D-01, A-06, NFR-SEC-03, T-09).

#### Scenario: Configuring custom prompt instructions
- **WHEN** user selects `prompt_type: "custom"` and provides a custom `prompt_template`
- **THEN** the API encrypts the template before database storage, returns plaintext only through the authenticated owner API response path, and makes the decrypted template available through shared runtime helpers for authorized processing

#### Scenario: Clearing predefined prompt templates
- **WHEN** user selects `prompt_type: "predefined"`
- **THEN** the API stores no custom prompt template for that flow and does not retain stale custom prompt plaintext or ciphertext

#### Scenario: Excluding custom prompts from logs
- **WHEN** custom prompt create, update, validation, or persistence fails
- **THEN** API errors and operational records do not include the custom prompt body

### Requirement: Flow Management Panel
The dashboard client SHALL provide interactive forms for managing briefing flows, toggling states, configuring custom prompt templates, and displaying warnings when quota limit is reached.

#### Scenario: Rendering the Ingestion Flows list
- **WHEN** the user navigates to the Ingestion Flows dashboard tab
- **THEN** the system lists all active flow configurations and displays action toggles
