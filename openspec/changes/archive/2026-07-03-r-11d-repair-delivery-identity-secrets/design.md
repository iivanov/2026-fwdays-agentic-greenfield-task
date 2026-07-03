# Design: R-11D delivery identity/secrets repair

## Decisions

1. **API derives identity-bound email config.** The Edge API uses the verified Supabase Auth user email (`email_confirmed_at` or equivalent confirmation marker) and ignores caller-supplied email destinations. This satisfies `BR-DEL-02` and `NFR-SEC-04` without adding a second email verification flow.
2. **Telegram uses one application bot.** Telegram channel config stores only `chat_id`; the app-owned bot token is read from runtime secrets only during verification/delivery. User-supplied `bot_token` is rejected so public-repo/browser paths cannot collect third-party credentials.
3. **Verification is adapter-backed.** `POST /channels/:id/verify` decrypts config and performs a type-specific proof before setting `status='active'`. Email and in-app verify locally because identity ownership is established by Supabase Auth; Telegram, Slack, and webhooks require successful provider/challenge calls.
4. **Webhook signing secret is one-time visible.** The generated secret remains encrypted in the database but is returned in plaintext only when it is first generated (create or update without an existing secret). All ordinary reads mask it.

## Security and Operations

- Secrets remain AES-256-GCM encrypted at rest and masked on normal reads.
- Generic webhook verification uses HTTPS-only URLs already guarded by SSRF validation and sends a signed challenge body using the generated signing secret.
- Runtime provider tokens are read from environment variables and never accepted from clients or committed.
- Provider calls use bounded timeouts and fail closed; unavailable provider credentials keep channels pending.
