# delivery-channels Delta

## ADDED Requirements

### Requirement: Delivery verification webhooks MUST not follow redirects

Slack and generic webhook verification requests MUST validate the target
immediately before the request and MUST NOT follow redirects.

#### Scenario: Webhook verification returns redirect

- **WHEN** a Slack or generic webhook verification endpoint returns any redirect
- **THEN** verification fails closed
- **AND** the redirect target is not requested.
