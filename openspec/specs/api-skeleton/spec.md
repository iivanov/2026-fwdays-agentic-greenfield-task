# api-skeleton Specification

## Purpose
TBD - created by archiving change r-06-api-skeleton. Update Purpose after archive.
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

