import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260703214519_r11e_restrict_shared_rls.sql',
  'utf8',
);

describe('R-11E shared source/article RLS migration', () => {
  it('removes broad authenticated shared-data select policies', () => {
    expect(migration).toContain(
      'drop policy if exists "Authenticated users can select global sources"',
    );
    expect(migration).toContain(
      'drop policy if exists "Authenticated users can select ingested articles"',
    );
    expect(migration).not.toMatch(/using\s*\(\s*auth\.role\(\)\s*=\s*'authenticated'\s*\)/i);
  });

  it('scopes global source reads through owned flow source links', () => {
    expect(migration).toContain('create policy "Users can select flow-linked global sources"');
    expect(migration).toContain('from public.flow_sources fs');
    expect(migration).toContain('join public.processing_flows pf on pf.id = fs.flow_id');
    expect(migration).toContain('fs.source_id = global_sources.id');
    expect(migration).toContain('pf.user_id = (select auth.uid())');
  });

  it('scopes ingested article reads through owned flow article claims', () => {
    expect(migration).toContain('create policy "Users can select own claimed ingested articles"');
    expect(migration).toContain('from public.flow_articles fa');
    expect(migration).toContain('join public.processing_flows pf on pf.id = fa.flow_id');
    expect(migration).toContain('fa.article_id = ingested_articles.id');
    expect(migration).toContain('pf.user_id = (select auth.uid())');
  });
});
