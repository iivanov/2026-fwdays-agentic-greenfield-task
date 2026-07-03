## 1. Crypto Encryption Module
- [ ] 1.1 Create `supabase/functions/api/crypto.ts` with AES-256-GCM encryption/decryption using Web Crypto API.
- [ ] 1.2 Write helper methods to parse, encrypt, and decrypt `config` schemas.

## 2. API Channels Endpoints
- [ ] 2.1 Implement `GET /channels` route in `helpers.ts` list mapping decrypting/masking secrets.
- [ ] 2.2 Implement `POST /channels` route validating payloads, executing SSRF check on generic webhooks, generating HMAC signing secrets, and encrypting config.
- [ ] 2.3 Implement `PUT /channels/:id` updating configs, re-encrypting schemas, and validating UUID segments.
- [ ] 2.4 Implement `DELETE /channels/:id` removing channels.
- [ ] 2.5 Implement `POST /channels/:id/verify` enabling active transitions.
- [ ] 2.6 Implement `GET /flows/:id/channels` and `POST /flows/:id/channels` handling channel associations.

## 3. API Integration Tests
- [ ] 3.1 Write unit tests in `crypto.test.ts` for AES-256-GCM encryption/decryption.
- [ ] 3.2 Add integration tests in `api-helpers.test.ts` validating channels CRUD routing.

## 4. UI Dashboard Component
- [ ] 4.1 Create `packages/browser/src/components/DeliveryPanel.tsx` managing active delivery channels, connection forms, verification loops, and flow linking.
- [ ] 4.2 Add Delivery Channels navigation tab links in `App.tsx` and render the panel.

## 5. Verification & Validation
- [ ] 5.1 Run formatter, linter, TypeScript compiler, and tests ensuring 100% pass rates.
- [ ] 5.2 Build production Vite bundle cleanly.
