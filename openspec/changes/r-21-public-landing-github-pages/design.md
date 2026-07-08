## Context

The browser package currently shows a compact OAuth sign-in shell to
unauthenticated users and relies on Vercel for static hosting. The user asked
for a landing page and GitHub Pages hosting. This change therefore updates the
technology/hosting layer first, then implements the browser and workflow
changes downstream.

The page remains part of the existing React/Vite browser app (`T-02`) and
continues to use Supabase Auth and Edge Functions for all stateful behavior
(`T-03`, `A-01`, `A-06`). GitHub Pages is static-only; it does not become an
API, scheduler, proxy, or secret store. Official GitHub Pages docs and the Vite
static deploy docs were checked on 2026-07-08.

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
- Deploy the Vite static build to GitHub Pages with a custom Actions workflow
  and pinned actions.
- Configure the Vite base path for GitHub Pages project URLs while keeping local
  dev and previews at `/`.
- Preserve the $0 hosting, public-repository tooling, and no-secrets boundary.

**Non-Goals:**

- No backend, database, RLS, queue, Supabase function, delivery provider, or
  OpenAI behavior changes.
- No automated creation of GitHub Pages settings, external accounts, custom
  domains, OAuth apps, or production deploys.
- No server-rendering layer, GitHub Pages server functions, or dynamic proxy.
- No new product behavior beyond the public explanation and sign-in entry.

## Decisions

1. **Use GitHub Pages Actions deployment instead of branch-published build
   artifacts.** GitHub's custom workflow path supports a Vite build without
   committing generated `dist` output. The workflow will run on `main` pushes
   and manual dispatch, use the `github-pages` environment, upload
   `packages/browser/dist`, and deploy through `actions/deploy-pages`.
   Alternative considered: a `gh-pages` branch. Rejected because it adds
   generated artifact churn and another branch to this single-developer repo.

2. **Use a configurable Vite base path.** Vite rewrites built asset paths based
   on `base`; project Pages sites default to `/<repository>/`. The config will
   derive `/<repo>/` from `GITHUB_REPOSITORY` in Actions unless
   `VITE_PUBLIC_BASE_PATH` is provided, while local dev/test remains `/`.
   Alternative considered: hard-code the repository name. Rejected because the
   local checkout does not expose a stable owner/repo contract.

3. **Handle SPA deep links with a built `404.html` copy.** GitHub Pages has no
   custom rewrite file equivalent to Vercel rewrites. Copying the built
   `index.html` to `404.html` lets `/dashboard` and `/auth/callback` load the
   app bundle on direct requests, then the existing client router/session logic
   decides whether to show the landing page or dashboard. Alternative
   considered: switch all app routes to hash URLs. Rejected because it would
   churn auth routing and existing tests.

4. **Make the public landing page the unauthenticated shell.** The existing
   session restoration remains the gate. If there is no session, the landing
   page renders product positioning, a generated newsroom hero image, workflow
   proof points, and OAuth buttons. Protected deep links continue to store a
   safe dashboard return path before login.

5. **Document GitHub Pages security limits honestly.** GitHub Pages provides
   HTTPS and public static hosting, but this repo cannot set the same custom
   response headers previously expressed in `vercel.json`. The static shell will
   include a conservative CSP meta tag where browser-supported, and sensitive
   work remains behind Supabase Auth/RLS/API boundaries. The loss of Vercel
   custom headers is documented as a hosting trade-off.

## Risks / Trade-offs

- **Risk: GitHub Pages source is not set to GitHub Actions** -> The workflow is
  committed, and docs/audit list the repository Pages setting as a human
  bootstrap item.
- **Risk: OAuth callback URLs differ on a project Pages subpath** -> Docs call
  out the generated `https://<owner>.github.io/<repo>/auth/callback` URL and
  Vite base is configurable for custom domains.
- **Risk: Direct deep links initially return HTTP 404 status while rendering the
  SPA fallback** -> `404.html` preserves browser behavior for users, and this is
  documented as the Pages fallback trade-off.
- **Risk: Weaker static response-header control than Vercel** -> Keep the
  frontend static-only, avoid secrets in browser variables, rely on Supabase
  Auth/RLS for protected data, and record the limitation in technology docs.
- **Risk: Generated visual asset increases repository size** -> Use one
  compressed project-local raster asset only and verify the Pages artifact stays
  far below GitHub Pages limits.

## Migration Plan

1. Update technology and hosting docs to select GitHub Pages for static
   frontend hosting and record 2026-07-08 verification sources.
2. Add OpenSpec delta specs and tasks.
3. Implement the landing page, routing/base-path support, generated asset, Pages
   workflow, audit updates, and focused tests.
4. Run local static/browser gates (`typecheck`, `lint`, `format`,
   `infra:audit`, focused/unit tests, browser build, e2e, OpenSpec validation,
   `git diff --check`).
5. Commit the planning/docs stage and implementation stage locally on `main`.
6. Human follow-up: in repository Settings -> Pages, choose GitHub Actions as
   the Pages source; add the GitHub Pages URL to Supabase Auth redirect URLs and
   API allowed origins before production OAuth smoke tests.
