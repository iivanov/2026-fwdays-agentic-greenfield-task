# Design

## Approach
The generated WebM is copied to `packages/browser/public/demo-video.webm`, which Vite copies to the site root at build time. The unauthenticated landing page renders a lower-page `video` section after the workflow cards, preserving the first-viewport product hero and OAuth entry points.

## UX
The section is titled "Watch the 81-second build walkthrough" and explains that the video covers both product behavior and the agentic engineering loop. Native browser controls are used for accessibility and predictable mobile behavior.

## Verification
Playwright smoke tests assert the section is visible on desktop and mobile and that `/demo-video.webm` is served as `video/webm`.
