## 1. API identity and config hardening

- [x] 1.1 Derive email channel config from verified authenticated user identity and reject unverified identities.
- [x] 1.2 Reject user-supplied Telegram bot tokens and store only chat IDs.
- [x] 1.3 Return generated generic webhook signing secrets only on the mutation response that creates them.

## 2. Functional verification

- [x] 2.1 Replace blind `POST /channels/:id/verify` activation with channel-type verification adapters.
- [x] 2.2 Fail closed with safe errors when runtime provider credentials or remote checks are unavailable.

## 3. UI and tests

- [x] 3.1 Remove Telegram bot-token collection from the browser delivery panel.
- [x] 3.2 Add unit tests for email identity binding, Telegram token rejection, verification failure/success behavior, and one-time webhook secret exposure.

## 4. Handoff

- [x] 4.1 Update `docs/state.md` and `docs/development_process.md` with the R-11D implementation status.
- [x] 4.2 Run applicable gates and retain independent verifier/reviewer reports before archive.
