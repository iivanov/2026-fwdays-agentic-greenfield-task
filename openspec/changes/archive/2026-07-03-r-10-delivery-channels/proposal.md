# Proposal: Delivery channels (in-app, email, Telegram, Slack, Webhook)

- **ID**: `r-10-delivery-channels`
- **Traceability**: `BR-DEL-01`, `BR-DEL-02`, `BR-DEL-03`, `BR-DEL-04`, `BR-DEL-05`, `BR-DEL-06`, `T-09`, `NFR-SEC-03`, `NFR-SEC-04`, `NFR-SEC-05`, `NFR-SEC-06`
- **Status**: proposed

## 1. Description

Implement secure delivery channel configurations for user profiles. Support standard notification endpoints:
1. `in-app` notifications (stored in db).
2. `email` notifications.
3. `telegram` links.
4. `slack` webhook integration.
5. `webhook` (generic signed HTTP POST endpoint).

Ensure robust security hygiene:
- Encrypt all credentials, API keys, webhook URLs, and secret fields at rest using AES-256-GCM.
- Protect generic webhooks against SSRF by blocking reserved, multicast, loopback, and private IPv4/IPv6 address scopes.
- Standardize webhook payload authentication signing via `HMAC-SHA256` using a per-channel cryptographically generated 32-byte signing secret.

## 2. Technical Decisions

- **AES-256-GCM Utility**: Create a self-contained Web Crypto API utility `crypto.ts` executing GCM encryption/decryption with `MASTER_CRYPTO_KEY`.
- **SSRF Address Check**: Integrate the segment-based resolver from `ssrf.ts` to block internal scopes on webhook URL registrations.
- **REST Endpoints**:
  - `GET /channels`: Returns all user delivery channels, decrypting config and masking secret strings.
  - `POST /channels`: Enforces Zod schemas, encrypts configuration attributes, validates SSRF scopes for webhook type, generates per-channel webhook secrets, and saves.
  - `PUT /channels/:id`: Re-encrypts configurations on updates and validates parameter ID UUIDs.
  - `DELETE /channels/:id`: Deletes the delivery channel.
  - `POST /channels/:id/verify`: Mock verifier triggering validation loop to transition status to `active`.
  - `POST /flows/:id/channels` / `GET /flows/:id/channels`: Links/lists delivery channels connected to flows.

## 3. Scope and Exclusions

- Background worker notification delivery runs are scheduled in Phase 3 (`R-11..R-15`) and are excluded from this slice. This slice focuses solely on configuration CRUD, encryption, masking, verification loops, flow link mappings, and UI dashboard controls.
