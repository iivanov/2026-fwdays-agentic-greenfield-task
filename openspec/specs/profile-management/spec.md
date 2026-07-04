# profile-management Specification

## Purpose
Define authenticated profile preference retrieval and update behavior for
interests and language preferences across the API and dashboard
(`BR-USER-02`, `A-06`, `NFR-UX-01`).
## Requirements
### Requirement: User Profile Retrieval
The API edge function SHALL allow authenticated users to fetch their current profile preferences (interests, language_preferences) from the database (satisfies BR-USER-02).

#### Scenario: Successfully retrieve profile
- **WHEN** an authenticated user makes a GET request to `/profiles`
- **THEN** the system returns a 200 response with data containing `id`, `email`, `interests`, and `language_preferences`

### Requirement: User Profile Modification
The API edge function SHALL validate payloads and allow authenticated users to update their profile preferences (interests, language_preferences) (satisfies BR-USER-02, A-06).

#### Scenario: Successfully update profile with valid preferences
- **WHEN** an authenticated user makes a PUT request to `/profiles` with valid `interests` array and `language_preferences` array
- **THEN** the system updates the profile and returns a 200 response with the updated fields

#### Scenario: Fail update on invalid schema payload
- **WHEN** an authenticated user makes a PUT request to `/profiles` with a malformed payload (e.g. non-array interests)
- **THEN** the system rejects the request with a 400 response and lists the validation errors

### Requirement: Profile Management Dashboard
The React frontend dashboard UI SHALL display the user's settings and allow them to interactive edit, delete keyword pills, select preferred target languages, and save settings (satisfies NFR-UX-01).

#### Scenario: Save settings successfully from UI
- **WHEN** the user interacts with the settings panel and clicks "Save Profile Settings"
- **THEN** the system sends a PUT request to the API, updates the UI query cache, and displays a success notification
