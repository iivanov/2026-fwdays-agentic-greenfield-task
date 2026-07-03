## Why

R-11A identified that custom flow prompts are stored as plaintext in `processing_flows.prompt_template`, contradicting `BR-FLOW-07`, `D-01`, `A-06`, `NFR-SEC-03`, and `T-09`. R-11C makes custom prompts encrypted at rest while preserving authorized owner access through the Edge API and excluding plaintext prompt values from logs and operational evidence.

## What Changes

- Encrypt custom `prompt_template` values with the existing AES-256-GCM runtime encryption helper before inserting or updating processing flows.
- Decrypt custom prompts only inside the authenticated API response path after RLS/user ownership has authorized the request.
- Normalize predefined flows so they do not retain stale custom prompt ciphertext.
- Add unit coverage proving custom prompts are stored encrypted, returned as plaintext only through the authorized API helper, constrained by user id when service-role access is required, and not leaked by persistence error handling.
- Update state/process records after verification and independent review.

## Capabilities

### Modified Capabilities

- `flow-management`: custom prompt templates are encrypted at rest and decrypted only for authorized flow owners through the API boundary.

## Impact

Affected files include the flow API helper, crypto helper tests/API tests, OpenSpec flow-management spec, and state/process/roadmap records. No provider accounts, deploys, paid services, or production data are required.
