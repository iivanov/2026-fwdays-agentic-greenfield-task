# Design: R-11E shared source/article RLS repair

## Decisions

1. **Restrict global source reads by owned flow-source links.** `global_sources` is a shared cache table, but an authenticated user may only see rows that are connected through `flow_sources` to a `processing_flows.user_id = auth.uid()` row.
2. **Restrict ingested article reads by owned flow-article claims.** `ingested_articles` can contain article content. Users may only read an article once it is claimed into their flow through `flow_articles`, whose flow ownership links back to `processing_flows.user_id = auth.uid()`.
3. **Keep service role as the worker path.** Backend workers and ingestion/processing jobs keep access via existing service-role grants and Supabase service-role bypass semantics; user-facing grants remain `SELECT` but RLS narrows visible rows.

## Security / RLS Notes

- Policies use `auth.uid()` ownership predicates and avoid broad `auth.role() = 'authenticated'` checks.
- The policy subqueries are indexed by existing `flow_sources_source_id_idx`, `flow_articles_article_id_idx`, and `processing_flows_user_id_idx` indexes.
- No secrets, provider state, or production data are committed.
