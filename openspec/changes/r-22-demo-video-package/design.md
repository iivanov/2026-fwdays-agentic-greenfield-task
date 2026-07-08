# Design

## Approach
The demo package is documentation-first and repo-local. It uses a static HTML/CSS slide deck so the video can be recorded without external slide software, and it uses Playwright against the existing e2e fixture build to produce deterministic screenshots without secrets or production data.

## Assets
- `docs/demo-video/index.html` is a 16:9 keyboard-driven deck.
- `docs/demo-video/styles.css` provides restrained editorial styling and simple CSS animation.
- `docs/demo-video/capture-screenshots.mjs` uses Playwright and local fixture routes to write screenshot PNGs.
- `docs/demo-video/generate-voiceover.mjs` loads `OPENAI_API_KEY` from local `.env` without printing it and writes `assets/voiceover.mp3`.
- `script.md` and `storyboard.md` define the narration and recording plan.

## Safety
The screenshot workflow uses fixture data and mocked dashboard API responses. The voiceover workflow never prints secret values and prefers the repo `.env` key to avoid stale exported shell keys shadowing the working project key.

## Verification
The implemented package is verified with formatting checks, Node syntax checks, screenshot generation, PNG dimension checks, a Playwright deck-render check, and audio duration inspection.
