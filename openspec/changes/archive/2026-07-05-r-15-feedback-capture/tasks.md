## 1. API

- [x] 1.1 Add authenticated `GET /digests` history/reporting route with
  user-scoped digest rows and feedback counts.
- [x] 1.2 Add authenticated `PUT /digests/:id/feedback` route that validates
  `thumbs_up`, `thumbs_down`, and `none`, updates only caller-owned digests,
  and does not touch prompt fields.
- [x] 1.3 Add API unit tests for reporting counts, invalid feedback rejection,
  owned update success, clear-to-none, and cross-user not-found behavior.

## 2. Browser

- [x] 2.1 Add an authenticated digest feedback panel that lists digest history,
  shows feedback counts, and renders thumbs up/down/clear controls.
- [x] 2.2 Wire the panel into dashboard navigation without changing existing
  profile/source/flow/delivery workflows.
- [x] 2.3 Add browser helper tests for feedback fetch, thumbs update, clear,
  visible counts, and API error display.

## 3. Documentation And Verification

- [x] 3.1 Update `docs/state.md`, `docs/roadmap.md`, and
  `docs/development_process.md` with R-15 progress and evidence.
- [x] 3.2 Run focused R-15 tests and relevant local gates
  (`npm run typecheck`, `npm run lint`, `npm run format`, `npm run test`,
  `npm run deno:check`, `npm run deno:lint`, `npm run deno:fmt`, and
  OpenSpec validation).
- [x] 3.3 Run independent verifier and reviewer sub-agents on the final diff,
  fix blocking findings, rerun both checker passes, then archive the change.
