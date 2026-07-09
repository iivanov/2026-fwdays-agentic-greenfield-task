---
trigger: always_on
description: Public-repo secret hygiene and the non-negotiable security defaults for this project.
---

# Rule: Security defaults and secret hygiene

This is a **public**, non-commercial repository. Treat every file as world-
readable and every user-supplied URL as hostile.

## Secrets — never commit

- Never commit secrets, API keys, `.env` values, OAuth tokens, provider state,
  database dumps, or generated private configuration. `.env.example` documents
  variable **names** only, with no real values.
- Keep secrets out of logs, test fixtures, snapshots, and error messages.
- If a secret is exposed, treat it as compromised: rotate it and record the
  incident; do not just delete the commit.

## Security defaults (from `NFR-SEC-*`, `A-06`, `AT-07`, `quality_standards.md §5`)

- **AuthZ:** deny-by-default; enable Row Level Security on every user-owned
  table; authorize every user-owned resource at the API boundary too. Derive
  user id from the verified JWT, never from the request body. Production sign-in
  is Google/GitHub OAuth only (password auth is local-dev only).
- **Encryption at rest:** delivery credentials, webhook URLs + signing secrets,
  and custom prompts are encrypted with AES-256-GCM (`{version, iv, ciphertext,
  tag}`); the master key lives only in the runtime secret store.
- **SSRF defense:** user source/webhook URLs must be HTTP/HTTPS and resolve to
  public addresses only — block loopback, private, link-local, multicast,
  reserved, and cloud-metadata ranges; re-validate after every redirect;
  generic webhooks do not follow redirects.
- **Webhook signing:** sign the exact body `HMAC-SHA256("<unix_ts>.<raw_body>")`
  with a per-channel 32-byte secret; expose a stable event id for receiver
  dedupe.
- **Input:** validate/sanitize all input (Zod at the boundary) against
  injection (prompt injection, XSS, SSRF). Least-privilege DB roles for workers.

## When in doubt

Any change touching auth, RLS, encryption, SSRF, signing, delivery, or
retention is "security-relevant" and **must** get the reviewer sub-agent pass
(see `20-maker-checker.md`). Prefer failing closed over failing open.
