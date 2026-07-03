## MODIFIED Requirements

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
