## ADDED Requirements

### Requirement: API helper decomposition MUST preserve the route contract
The `api` Edge Function implementation MAY decompose helper internals into smaller modules, but it MUST preserve existing route behavior, response envelopes, validation behavior, CORS headers, authenticated-user handling, encrypted prompt/config handling, SSRF-protected delivery verification, and the stable helper import surface (`T-01`, `T-03`, `T-06`, `T-09`, `T-12`).

#### Scenario: Decomposed API helpers preserve existing route behavior
- **WHEN** tests invoke profile, source, flow, digest, and delivery-channel routes through `handleApiRoute` or `apiHandler`
- **THEN** the returned statuses, response envelopes, database calls, and masking/encryption behavior match the pre-decomposition implementation

#### Scenario: Decomposed API helpers keep stable imports
- **WHEN** `api/index.ts` and API helper tests import helpers from `supabase/functions/api/helpers.ts`
- **THEN** `getCorsHeaders`, `sendSuccess`, `sendError`, `validateBody`, `handleApiRoute`, `apiHandler`, `verifyDeliveryChannelTarget`, `generateSigningSecret`, and `validateChannelConfig` remain available
