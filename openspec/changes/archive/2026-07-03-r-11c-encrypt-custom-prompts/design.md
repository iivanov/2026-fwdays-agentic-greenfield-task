## Context

The data model documents `processing_flows.prompt_template` as encrypted when custom, and NFR-SEC-03 requires custom prompts to be encrypted at rest and excluded from logs. Delivery channel configuration already uses application-level AES-256-GCM helpers, but flow create/update currently stores `prompt_template` directly as plaintext.

## Decisions

1. **Reuse application AES-256-GCM helpers.** R-11C encrypts prompt payloads in the Edge API with the same Web Crypto helper used for sensitive delivery config, satisfying T-09 without adding new provider dependencies.
2. **Keep the existing column shape for compatibility.** `prompt_template` remains a nullable text column and stores a serialized encrypted payload for custom prompts. This avoids a destructive schema rewrite while still removing plaintext at rest.
3. **Decrypt only after authenticated API authorization.** Because authenticated Data API column privileges intentionally exclude `prompt_template`, the Edge API uses the service-role client only after JWT authentication and always constrains service-role flow reads/updates by the JWT-derived `user.id` before decrypting. Tests cover these user filters. Direct authenticated database reads cannot read or write the prompt column.
4. **Clear prompts for predefined flows.** When a flow is set to `predefined`, the API stores `null` for `prompt_template` to avoid stale custom prompt ciphertext being retained unnecessarily.
5. **No logging of prompt bodies.** Validation/errors continue returning schema messages only; tests assert stored values and response values without logging prompt contents.

## Risks / Trade-offs

- Existing plaintext rows cannot be encrypted in a SQL migration because the runtime encryption key is not available to the database migration. This greenfield repo has no production data, so the R-11C migration removes pre-R-11C plaintext custom prompt values in local/dev databases rather than preserving plaintext at rest. A deployed product with production data would need a one-time runtime backfill under human-controlled secrets before applying the column restriction.
- Browser code using the Edge API still receives plaintext custom prompts for editing. That is authorized plaintext use by the owning user, not at-rest storage.
