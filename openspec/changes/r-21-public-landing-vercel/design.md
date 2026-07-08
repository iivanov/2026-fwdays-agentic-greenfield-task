## Context

The browser package currently shows a compact OAuth sign-in shell to
unauthenticated users and relies on Vercel for static hosting. The user clarified
that the application should remain on Vercel; this change therefore keeps the
existing hosting decision and implements a public landing page inside the Vercel
served React/Vite browser app.

The page remains part of the existing React/Vite browser app (`T-02`) and
continues to use Supabase Auth and Edge Functions for all stateful behavior
(`T-03`, `A-01`, `A-06`). Vercel remains static-only; it does not become an API,
scheduler, proxy, or secret store.

Design subject: AI news desk for operators who want source-backed daily
digests. Audience: a first-time project reviewer or user deciding whether to
sign in and configure a digest. Single job: explain the controlled daily-news
workflow and route the visitor to OAuth sign-in.

## Goals / Non-Goals

**Goals:**

- Provide a polished public landing page before authentication that follows
  `docs/DESIGN.md` and remains responsive across desktop and mobile.
- Preserve Google/GitHub OAuth entry points, callback error handling, protected
  dashboard routing, local fixture mode, and production-hidden password auth.
- Preserve Vercel deployment config, SPA rewrites, and static security headers.
- Preserve the $0 hosting, public-repository tooling, and no-secrets boundary.

**Non-Goals:**

- No backend, database, RLS, queue, Supabase function, delivery provider, or
  OpenAI behavior changes.
- No automated creation of Vercel projects, external accounts, custom domains,
  OAuth apps, or production deploys.
- No server-rendering layer, Vercel Functions, Vercel Cron, or dynamic proxy.
- No new product behavior beyond the public explanation and sign-in entry.

## Decisions

1. **Keep Vercel as the static frontend host.** The current upstream technology
   docs already select Vercel Hobby for the browser app because it gives Vite
   build support, HTTPS, SPA rewrites, custom headers, and preview deployments
   within the $0/non-commercial scope. Alternative considered after the user's
   initial wording: GitHub Pages. Rejected after clarification because the user
   wants the application hosted on Vercel.

2. **Make the public landing page the unauthenticated shell.** The existing
   session restoration remains the gate. If there is no session, the landing
   page renders product positioning, a generated newsroom hero image, workflow
   proof points, and OAuth buttons. Protected deep links continue to store a
   safe dashboard return path before login.

3. **Use a real bitmap hero asset.** The landing page uses one generated
   project-local newsroom image to make the product concrete in the first
   viewport. Alternative considered: CSS-only cards. Rejected because project
   website guidance requires visual assets and a real subject signal.

4. **Keep static headers aligned with landing assets.** `vercel.json` remains
   the response-header source for CSP and browser hardening. The CSP allows the
   selected Google font endpoints and Supabase connections while keeping frame,
   object, and form restrictions tight.

## Risks / Trade-offs

- **Risk: Landing page weakens sign-in routing** -> Keep existing OAuth handler
  functions and add Playwright coverage for root, protected routes, and callback
  errors.
- **Risk: New fonts/assets are blocked by CSP** -> Update `vercel.json` and
  browser meta CSP consistently, then verify with browser build/e2e.
- **Risk: Generated visual asset increases repository size** -> Use one
  project-local raster asset only and verify the browser build remains small.

## Migration Plan

1. Keep technology and hosting docs on Vercel static frontend hosting and record
   the user clarification in the development process.
2. Add OpenSpec delta specs and tasks.
3. Implement the landing page, generated asset, Vercel header adjustment, audit
   updates, and focused tests.
4. Run local static/browser gates (`typecheck`, `lint`, `format`,
   `infra:audit`, focused/unit tests, browser build, e2e, OpenSpec validation,
   `git diff --check`).
5. Commit the planning/docs stage and implementation stage locally on `main`.
6. Human follow-up: keep Vercel configured with repository root builds and add
   the Vercel production URL to Supabase Auth redirect URLs and API allowed
   origins before production OAuth smoke tests.
