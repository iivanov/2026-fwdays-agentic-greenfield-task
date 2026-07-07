## MODIFIED Requirements

### Requirement: Delivery Channel Identity and Functional Verification

Delivery channels SHALL be bound to approved identities and SHALL only become
active after type-appropriate verification (satisfies BR-DEL-02..05, A-05,
A-06, NFR-SEC-03, NFR-SEC-04, NFR-SEC-06).

#### Scenario: Telegram chat ID is returned by the application bot

- **WHEN** a Telegram user sends a direct or group message to
  `@news_desk_ai_bot`
- **THEN** the application-owned bot replies with the numeric Telegram chat ID
- **AND** the reply tells the user to paste that value into the Delivery
  dashboard's Telegram Chat ID field
- **AND** the dashboard still collects only the chat identifier, not bot tokens
  or webhook secrets

### Requirement: Delivery Management Panel

The dashboard client SHALL provide interactive tab panels for configuring,
testing/verifying, linking, and removing delivery channels (satisfies
BR-DEL-01, BR-DEL-02).

#### Scenario: Telegram setup guidance names the application bot

- **WHEN** the user selects Telegram delivery in the Delivery Channels
  dashboard tab
- **THEN** the dashboard identifies the application-owned bot as
  `@news_desk_ai_bot`
- **AND** it explains that the bot replies with the numeric chat ID for the
  selected direct or group chat
- **AND** it warns users not to paste the bot token into the browser
