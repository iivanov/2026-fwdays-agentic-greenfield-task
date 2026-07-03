## 1. OpenSpec planning

- [x] 1.1 Create proposal, design, delta spec, and tasks for R-11C.
- [x] 1.2 Validate the R-11C OpenSpec change strictly before implementation.

## 2. Prompt encryption implementation

- [x] 2.1 Add prompt-specific encryption/decryption helpers or API utilities using AES-256-GCM.
- [x] 2.2 Encrypt custom prompts on flow create/update and clear prompt data for predefined flows.
- [x] 2.3 Decrypt custom prompts only for authenticated owner API responses.

## 3. Verification coverage

- [x] 3.1 Add unit tests proving encrypted-at-rest storage and authorized plaintext API response behavior.
- [x] 3.2 Run applicable local gates and retain independent verifier evidence.
- [x] 3.3 Run independent review and retain final disposition.

## 4. Archive and records

- [x] 4.1 Sync/archive the OpenSpec change after green verification and review.
- [x] 4.2 Update roadmap, state, and development-process records.
