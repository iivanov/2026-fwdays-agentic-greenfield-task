## MODIFIED Requirements

### Requirement: Repository Demo Video Package
The repository SHALL provide a self-contained demo-video package and browser-served final MP4 that supports recording and viewing a 1-2 minute product and agentic-development demo without requiring production data, external slide tooling, or committed secrets.

#### Scenario: Final MP4 is available to the browser landing page
- **WHEN** the browser app is built
- **THEN** the generated demo video is available as `/demo-video.mp4`
- **AND** the served asset uses the `video/mp4` content type
