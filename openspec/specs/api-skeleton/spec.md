# api-skeleton Specification

## Purpose
Define the authenticated Edge Function API boundary, including CORS, JWT
session enforcement, response envelopes, and Zod request validation for the
application service layer (`A-01`, `A-06`, `NFR-SEC-02`).
## Requirements
### Requirement: CORS Preflight and headers allowlist
The api Edge Function SHALL handle preflight OPTIONS requests and attach CORS headers to all responses (satisfies A-01).

#### Scenario: Preflight preflight requests
- **WHEN** an OPTIONS request is received
- **THEN** response status code is 200
- **AND** response has correct CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`)

### Requirement: JWT session authentication
All endpoints except `/health` SHALL require a valid JWT token in the Authorization header. Access without a valid JWT SHALL be rejected with 401 Unauthorized (satisfies A-06, NFR-SEC-02).

#### Scenario: Missing Authorization Token
- **WHEN** a request is made to `/profiles` without a token
- **THEN** response status code is 401
- **AND** error field contains "Unauthorized"

### Requirement: JSON Response Envelope
All API endpoints SHALL return JSON responses structured inside a `{data, error}` envelope (satisfies A-01).

#### Scenario: Standard success response
- **WHEN** the health check is requested
- **THEN** the JSON payload contains `data` and `error` keys where `data` is not null and `error` is null

### Requirement: API helper decomposition MUST preserve the route contract
The `api` Edge Function implementation MAY decompose helper internals into smaller modules, but it MUST preserve existing route behavior, response envelopes, validation behavior, CORS headers, authenticated-user handling, encrypted prompt/config handling, SSRF-protected delivery verification, and the stable helper import surface (`T-01`, `T-03`, `T-06`, `T-09`, `T-12`).

#### Scenario: Decomposed API helpers preserve existing route behavior
- **WHEN** tests invoke profile, source, flow, digest, and delivery-channel routes through `handleApiRoute` or `apiHandler`
- **THEN** the returned statuses, response envelopes, database calls, and masking/encryption behavior match the pre-decomposition implementation

#### Scenario: Decomposed API helpers keep stable imports
- **WHEN** `api/index.ts` and API helper tests import helpers from `supabase/functions/api/helpers.ts`
- **THEN** `getCorsHeaders`, `sendSuccess`, `sendError`, `validateBody`, `handleApiRoute`, `apiHandler`, `verifyDeliveryChannelTarget`, `generateSigningSecret`, and `validateChannelConfig` remain available
