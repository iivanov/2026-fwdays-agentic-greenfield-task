# Proposal: Repair delivery identity and secret verification

## Why

The R-11 audit found that delivery channel configuration can contradict upstream delivery requirements: email channels can target arbitrary addresses, Telegram asks users for bot tokens instead of using the app-owned bot, the verify endpoint marks channels active without proving the target works, and generic webhook signing secrets are repeatedly visible as masked list data instead of being one-time credentials.

## Traceability

- `BR-DEL-02`: email delivery only to the authenticated user's verified email.
- `BR-DEL-03`: Telegram delivery through the application-owned bot after chat linking.
- `BR-DEL-04`: Slack delivery to user-configured incoming webhook.
- `BR-DEL-05`: generic webhook delivery as signed HTTPS JSON.
- `D-04`: encrypted reusable delivery-channel configuration.
- `A-05`, `A-06`: integration adapters and authenticated/authorized API boundary.
- `NFR-SEC-03`, `NFR-SEC-04`, `NFR-SEC-06`: secret protection, email anti-abuse, and abuse controls.

## What Changes

- Derive email channel destination from the authenticated verified identity; reject email channel creation/updates when the identity email is unverified.
- Remove user-supplied Telegram bot tokens from API and UI; store only Telegram chat identifiers and verify them with the app-owned runtime bot token.
- Replace blind channel activation with functional verification adapters for email/in-app, Telegram, Slack, and generic webhook challenge checks.
- Return generic webhook signing secrets only in the create/update response that generated them; list/get/flow-link reads keep the secret masked.
- Add unit coverage for identity binding, Telegram token rejection, functional verification failures, and one-time webhook secret exposure.

## Non-Goals

- Implement digest delivery workers; R-14 owns actual digest delivery.
- Create provider accounts, secrets, or production verification evidence.
- Change delivery channel retention or queue semantics.
