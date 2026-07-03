# Proposal: Restrict shared source/article RLS

## Why

R-11 audit finding 3 identified that shared `global_sources` and `ingested_articles` rows are readable by every authenticated user. That violates deny-by-default authorization for shared cache records because users should only see shared sources and articles through their own flow links or service-role background processing.

## Traceability

- `D-01`, `D-02`: shared source/article records must preserve ownership boundaries through flow links.
- `A-06`: API and data access must enforce authenticated user authorization.
- `NFR-SEC-02`, `NFR-SEC-03`: deny-by-default isolation and secret/content protection.

## What Changes

- Replace broad authenticated `SELECT` RLS policies on `global_sources` and `ingested_articles`.
- Allow `global_sources` reads only when the source is linked to one of the authenticated user's flows.
- Allow `ingested_articles` reads only when the article has been claimed by one of the authenticated user's flows.
- Preserve service-role access for backend workers through existing service-role grants.
- Add tests that assert the migration removes broad authenticated policies and installs ownership-linked policies.

## Non-Goals

- Reworking source ingestion or article claiming behavior; R-12 owns ingestion and R-13 owns processing.
- Repairing queue acknowledgement or retention defects; those remain R-11F/R-11G.
