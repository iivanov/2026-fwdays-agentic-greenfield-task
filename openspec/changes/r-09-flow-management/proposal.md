## Why

Users need the ability to configure multiple customized briefing flows (up to 5) to isolate different subject matters (e.g. "Security Briefing" vs "Crypto News"). Each flow should allow choice of prompt template (default predefined briefing vs custom AI persona instruction templates). We need full CRUD API endpoints and an interactive React management panel.

## What Changes

- **API Flow Endpoints**: Implement `GET /flows`, `POST /flows`, `PUT /flows/:id`, and `DELETE /flows/:id` endpoints inside the Edge Function helpers router.
- **Quota Error Handling**: Intercept PostgreSQL quota trigger exceptions and return clean `400` validation errors to the client.
- **Dashboard UI Panel**: Create a dedicated `FlowsPanel.tsx` component in the React client managing active briefs, custom prompt configurations, and toggle controls.
- **Navigation Integration**: Link the new `FlowsPanel` tab in `App.tsx`.

## Capabilities

### New Capabilities

- `flow-management`: Allows creating, reading, updating, and deleting briefing flows, with custom prompts and a maximum limit of 5.

### Modified Capabilities
