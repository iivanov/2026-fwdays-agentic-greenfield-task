## Design

### Structured logs

Add a small runtime helper in the Edge Function code that emits JSON logs with
only safe identifiers and counters:

- correlation/request id,
- function name,
- queue name, message id, read count, job kind,
- source/flow/digest/attempt/cycle ids when present,
- status/outcome, duration, retry/circuit/provider request metadata.

The helper must not log article content, digest content, prompts, provider
tokens, webhook URLs, channel configuration, or remote response bodies. Runtime
tests assert both the presence of trace identifiers and absence of sensitive
fields.

### Operational event alerting

`operational_events.alerted_at` already exists. Add a service-role RPC that
atomically claims an alert send for a critical unresolved event when either no
alert has been sent or the previous alert is older than one hour. The RPC keeps
the dedupe decision in the database so concurrent workers cannot send duplicate
operator emails.

The worker will:

1. log/upsert a sanitized `OperationalEvent`,
2. claim the alert slot for critical events,
3. send a compact Brevo email to `OPERATOR_ALERT_EMAIL` using
   `BREVO_API_KEY` and `BREVO_SENDER_EMAIL`,
4. avoid failing the domain operation if the alert email send fails; instead it
   logs a sanitized warning event.

This reuses the selected Brevo HTTP API (`T-10`) and does not introduce a new
provider.

### AI budget guardrails

R-13 stores model/request usage after successful digest persistence, but it does
not fail closed before a configured free-tier budget is exhausted. R-17 adds
runtime budget environment variables interpreted as non-secret numeric limits:

- `AI_DAILY_TOKEN_BUDGET` - max total tokens allowed for the current UTC day.
- `AI_RESPONSE_TOKEN_BUDGET` - max tokens a single provider response may report.

Before an OpenAI request, the worker sums successful digest usage plus
content-free failed provider usage events for the current UTC day. If the daily
budget has already been reached, it throws `ai_budget_exhausted`, records a
sanitized `provider_quota` event, and acknowledges the processing queue message
through a terminal failure RPC so the same job does not spend again. After a
provider response, before schema validation or schema-repair retries, if the
response usage exceeds the configured per-response budget or pushes the daily
budget over the limit, the worker records the failed response usage in the
budget ledger, records `provider_quota`, and fails terminally before persisting
the digest. Schema-invalid responses that are under budget are recorded as
content-free failed provider usage before the one allowed repair attempt, so
repair retries cannot hide provider spend from the daily ledger.

Unset or invalid budgets are treated as disabled so local development and tests
remain deterministic. Budgets are guardrails, not billing integration.

### Security and data lifecycle

- Alert emails contain IDs, categories, severity, and counts only.
- Operational event context remains JSON identifiers/counters only.
- No secrets or content are logged or stored.
- New tables/RPCs are revoked from public/authenticated access where applicable
  and granted only to `service_role` and `postgres`.
- No new public tables or client-side service-role access is introduced.

### Verification

Focused Vitest coverage should prove:

- structured logs include correlation/job IDs and omit content/secrets;
- exhausted/critical work can claim exactly one alert per cooldown window;
- AI daily and per-response budget failures record `provider_quota` events and
  do not persist digests;
- malformed over-budget AI responses do not trigger schema repair and still
  record failed usage;
- SQL grants/RPC behavior support service-role-only alert claims.

Supabase migration lint and integration tests remain applicable.
