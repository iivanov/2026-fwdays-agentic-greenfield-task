# Design

## Scope

The slice completes the runtime delivery step after a processed digest exists.
It keeps queue payloads ID-only and relies on the existing `processed_digests`,
`flow_delivery_channels`, `delivery_channels`, `digest_delivery_attempts`, and
`integration_circuits` tables.

## Data Flow

1. The processing worker persists a digest via the existing service-role RPC.
2. A new service-role RPC creates missing attempts for active channels mapped to
   the flow and enqueues one `delivery-queue` message per attempt.
3. The delivery worker claims the attempt by moving an eligible row to
   `sending`, loads the digest/channel/flow records, and dispatches through a
   channel adapter.
4. Success calls the transactional completion RPC so attempt status, channel
   failure counters, circuit state, and queue acknowledgement are committed
   before the message is removed.
5. Failures are classified:
   - transient: retry with exponential backoff, provider `Retry-After` when
     longer, and circuit failure accounting;
   - permanent: mark the digest attempt failed and acknowledge the queue item;
   - circuit-open: short-circuit as transient without contacting the provider.

## Adapters

- **In-app:** attempt completion only; the digest is already persisted.
- **Email:** Brevo SMTP HTTP API using `BREVO_API_KEY` and
  `BREVO_SENDER_EMAIL`. The recipient comes from the encrypted channel config,
  which R-11D restricts to the authenticated user's verified identity email.
- **Telegram:** application-owned `TELEGRAM_BOT_TOKEN`; chat id comes from
  encrypted channel config.
- **Slack:** encrypted incoming webhook URL; JSON body only; no redirects.
- **Generic webhook:** encrypted HTTPS URL and signing secret; POST versioned
  JSON schema with stable event id equal to `DigestDeliveryAttempt.id`; sign the
  exact raw body with HMAC-SHA256 over `<unix_timestamp>.<raw_body>` and send
  `X-News-Event-Id`, `X-News-Timestamp`, and `X-News-Signature`.

Slack and generic webhook requests use the shared SSRF helper immediately
before every request. Generic webhooks require HTTPS and no redirects.

## Security

Workers use service-role access but load only record IDs from queue messages.
Logs and errors store sanitized codes/statuses, not digest text, provider
responses, URLs, prompts, or credentials. Sensitive channel configuration is
decrypted in memory only for the selected adapter. Generic webhook secrets are
never logged and are used only to sign the exact JSON body.

## Reliability

Delivery HTTP calls default to a 10 second timeout, below the 30 second worker
contract. Attempts are claimed with a lease before the external call. Transient
failures use exponential backoff capped at 30 minutes and are dead-lettered by
the existing queue exhaustion path after five reads. Channels are disabled after
five consecutive failed digest deliveries. Integration circuits open after five
classified transient failures and back off probes up to one hour.

## Provider Documentation

Supabase changelog was checked on 2026-07-04. No R-14-relevant breaking change
for Edge Functions, queues, or local migrations was found. Brevo, Telegram, and
Slack adapter shapes follow their current HTTP API contracts as of 2026-07-04.
