## 1. API Flow Endpoints

- [ ] 1.1 Implement `GET /flows` retrieving the user's flows.
- [ ] 1.2 Implement `POST /flows` validating names and prompt configurations, catching database quota trigger exceptions, and returning 400s.
- [ ] 1.3 Implement `PUT /flows/:id` extracting ID from path parameters and updating flow settings.
- [ ] 1.4 Implement `DELETE /flows/:id` deleting the flow and cascading links.

## 2. API Integration Tests

- [ ] 2.1 Add Vitest cases in `api-helpers.test.ts` for GET list, POST valid flow, POST quota exception, PUT updates, and DELETE removal.

## 3. UI Component Settings

- [ ] 3.1 Create `packages/browser/src/components/FlowsPanel.tsx` with a flows list, enable toggle, custom prompt editor, and create/edit/delete triggers.
- [ ] 3.2 Adjust `SourcesPanel.tsx` default briefing creation mutation to use correct column `is_enabled` instead of `enabled`.
- [ ] 3.3 Add Flows navigation tab links in `App.tsx` and mount the new panel.

## 4. Verification & Validation

- [ ] 4.1 Run TypeScript compiles and static rule lints ensuring zero warnings.
- [ ] 4.2 Run full test suite confirming all tests pass.
- [ ] 4.3 Build production client bundle successfully.
