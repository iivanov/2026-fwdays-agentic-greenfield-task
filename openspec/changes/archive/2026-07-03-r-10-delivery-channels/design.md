# Design: Delivery channels configuration

- **ID**: `r-10-delivery-channels`

## 1. Crypto Module (`crypto.ts`)
- Utilizes Web Crypto API (`crypto.subtle`) for native performance and Node/Deno portability.
- Uses AES-256-GCM scheme.
- Appends the standard 16-byte authentication tag to the cipher text.
- Generates 12-byte initialization vectors (IV).
- Reads master key `MASTER_CRYPTO_KEY` from Deno.env/Node.env.
- Masks secret strings on retrieval APIs:
  - Slack webhooks: replace everything after `services/` with `*****`.
  - Generic webhooks: replace secret keys and query parameters with `*****`.
  - Telegram chat IDs: mask numerical IDs (e.g. `12345***`).

## 2. SSRF Webhook Protection
- Resolves hostname of generic webhook endpoints using `resolveDns` segment validation.
- Re-uses `ssrf.ts` validation routines, blocking private IPv4 and IPv6 transition scopes.

## 3. REST API Endpoints
- `GET /channels`: Returns all user delivery channels. Decrypts `config` and applies masking filters to sensitive properties.
- `POST /channels`:
  - Enforces strict schema validations using Zod.
  - Generates HMAC signing secrets for generic webhooks.
  - Encrypts configurations via AES-256-GCM.
- `PUT /channels/:id`: Validates ID segment parameter format, re-encrypts updated credential configs, and updates the record.
- `DELETE /channels/:id`: Removes the channel configuration.
- `POST /channels/:id/verify`: Checks verification status and advances channel status to `active` (e.g., triggers a mock verification challenge or activates).
- `GET /flows/:id/channels` and `POST /flows/:id/channels`: Manages linkage mapping records.

## 4. UI Layout
- Introduces a tab in the dashboard layout.
- Renders a clean interface with connection buttons for Slack webhooks, email lists, Telegram, and generic targets.
- Displays masking credentials clearly to ensure safe visual confirmation.
