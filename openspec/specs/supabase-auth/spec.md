# supabase-auth Specification

## Purpose
Define Supabase Auth expectations for Google/GitHub OAuth PKCE, local-only
password-auth posture, session handling, and profile creation linkage
(`BR-USER-01`, `T-06`, `NFR-SEC-01`).
## Requirements
### Requirement: Google and GitHub OAuth (PKCE Flow)
The system SHALL support user registration and authentication via Google and GitHub OAuth using the PKCE flow (satisfies BR-USER-01, T-06, NFR-SEC-01).

#### Scenario: Verify PKCE Configuration in Browser Client
- **WHEN** the browser package client is initialized
- **THEN** the auth configuration has `flowType` set explicitly to `'pkce'`

### Requirement: Local-Only Password Authentication
Email and password authentication SHALL be enabled only for local development and disabled in production (satisfies BR-USER-01, NFR-SEC-01).

#### Scenario: Verify local configuration
- **WHEN** looking at `supabase/config.toml`
- **THEN** `auth.email.enable_signup` is `true` for local convenience, but documentation/env configuration warns that password auth must be disabled in production

### Requirement: Profile and Channel Auto-Provisioning
Upon first authentication, the system SHALL automatically create a profile in the `profiles` table and default `in-app` and `email` delivery channels (satisfies T-06, BR-DEL-01).

#### Scenario: User Profile Creation
- **WHEN** a new user record is created in `auth.users`
- **THEN** a matching record is inserted into `public.profiles` with the same `id` and `email`
- **AND** a default `in-app` delivery channel is created with `status = 'active'`
- **AND** a default `email` delivery channel is created with `status = 'active'` (if OAuth verified) or `status = 'pending'`
