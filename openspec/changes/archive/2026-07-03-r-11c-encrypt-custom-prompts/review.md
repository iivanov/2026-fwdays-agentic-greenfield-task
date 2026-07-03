# R-11C Independent Review Report

Date: 2026-07-03
Change: `r-11c-encrypt-custom-prompts`
Reviewer: independent checker sub-agent

## Attempt 1 — REQUEST CHANGES

The reviewer requested changes for four blocking findings:

1. Existing plaintext custom prompts were not remediated.
2. The service-role prompt access pattern needed to be explicit in design and tested for owner filtering before decryption.
3. Prompt crypto helpers were private to the API helper and not available to future authorized processing code.
4. No-leak error coverage for custom prompt persistence failures was missing.

## Maker resolution

- Added a migration that removes broad authenticated `processing_flows` privileges, re-grants column-specific access excluding `prompt_template`, and nulls pre-R-11C local/dev plaintext custom prompts in this greenfield no-production repository.
- Documented the service-role API authorization pattern and production-backfill implications in the R-11C design.
- Exported shared `encryptPromptTemplate` / `decryptPromptTemplate` helpers from `crypto.ts`; plaintext/malformed prompt values now resolve to `null` instead of echoing legacy plaintext.
- Added service-role owner-filter tests and persistence-error no-leak tests.

## Attempt 2 — APPROVE

The independent reviewer approved the final diff with no blocking findings. The review confirmed that previous blockers were resolved: existing plaintext/no-production handling is implemented and documented, service-role prompt access is constrained by JWT-derived owner identity, direct authenticated column grants exclude `prompt_template`, shared prompt crypto helpers are exported, plaintext fallback no longer returns prompt values, and persistence errors do not echo prompt bodies.
