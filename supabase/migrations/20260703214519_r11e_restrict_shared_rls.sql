-- R-11E: restrict shared source/article reads to owning flow links.
-- Upstream: D-01, D-02, A-06, NFR-SEC-02, NFR-SEC-03

-- Remove broad authenticated shared-cache reads that exposed all global sources
-- and article content to every signed-in user.
drop policy if exists "Authenticated users can select global sources" on public.global_sources;
drop policy if exists "Authenticated users can select ingested articles" on public.ingested_articles;

-- Authenticated users can read a shared source only when it is linked to one of
-- their own processing flows. Background workers continue to use service_role.
create policy "Users can select flow-linked global sources"
on public.global_sources
for select
to authenticated
using (
  exists (
    select 1
    from public.flow_sources fs
    join public.processing_flows pf on pf.id = fs.flow_id
    where fs.source_id = global_sources.id
      and pf.user_id = (select auth.uid())
  )
);

-- Article content becomes user-visible only after the article is claimed into
-- that user's flow. Unclaimed/shared cache rows remain service-role-only.
create policy "Users can select own claimed ingested articles"
on public.ingested_articles
for select
to authenticated
using (
  exists (
    select 1
    from public.flow_articles fa
    join public.processing_flows pf on pf.id = fa.flow_id
    where fa.article_id = ingested_articles.id
      and pf.user_id = (select auth.uid())
  )
);
