import { describe, expect, it } from 'vitest';
import {
  createWorkHandler,
  extractArticleFromHtml,
  fetchTextWithTimeout,
  fetchWithTimeout,
  ingestSource,
  parseFeedItems,
} from '../../../../supabase/functions/work/index.ts';
import { SsrfProtectionError } from '../../../../supabase/functions/api/ssrf.ts';

const SERVICE_KEY = 'test-service-key';
const SOURCE_ID = '22222222-2222-4222-9222-222222222222';
const AUTH_REQ = new Request('http://localhost/functions/v1/work', {
  headers: { Authorization: `Bearer ${SERVICE_KEY}` },
});

type Row = Record<string, unknown>;
type FakeTables = Record<string, Row[]>;
type RpcCall = { name: string; args?: Record<string, unknown> };
type FakeClientOptions = {
  source?: Row;
  fingerprints?: Row[];
  rpcResponses?: Record<string, unknown>;
};

const makeQuery = (
  rows: Row[],
  execute: (predicates: Record<string, string>) => { error: { message: string } | null },
) => {
  const predicates: Record<string, string> = {};
  const query = {
    eq: (column: string, value: string) => {
      predicates[column] = value;
      return query;
    },
    limit: () => query,
    maybeSingle: async () => ({
      data:
        rows.find((row) =>
          Object.entries(predicates).every(([column, value]) => row[column] === value),
        ) ?? null,
      error: null,
    }),
    then: (
      resolve: (value: { error: { message: string } | null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(execute(predicates)).then(resolve, reject),
  };
  return query;
};

const makeClient = (options: FakeClientOptions = {}) => {
  const tables: FakeTables = {
    global_sources: [
      options.source ?? {
        id: SOURCE_ID,
        url: 'https://feeds.example.com/news.xml',
        type: 'rss',
        status: 'active',
        failed_fetch_count: 0,
      },
    ],
    source_item_fingerprints: [...(options.fingerprints ?? [])],
    ingested_articles: [],
    source_fetch_runs: [{ source_id: SOURCE_ID, cycle_date: '2026-07-04', status: 'pending' }],
  };
  const rpcCalls: RpcCall[] = [];
  const updates: Array<{ table: string; patch: Row; predicates: Record<string, string> }> = [];

  const client = {
    tables,
    rpcCalls,
    updates,
    rpc: async (name: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === 'claim_job') {
        return {
          data:
            args?.queue_name === 'delivery-queue' || args?.queue_name === 'processing-queue'
              ? []
              : [
                  {
                    msg_id: 12,
                    read_ct: 1,
                    enqueued_at: new Date().toISOString(),
                    message: { type: 'ingestion', source_id: SOURCE_ID, cycle_date: '2026-07-04' },
                  },
                ],
          error: null,
        };
      }
      return { data: options.rpcResponses?.[name] ?? {}, error: null };
    },
    from: (table: string) => ({
      select: () => makeQuery(tables[table] ?? [], () => ({ error: null })),
      insert: (payload: Row | Row[]) =>
        makeQuery(tables[table] ?? [], () => {
          const target = tables[table] ?? (tables[table] = []);
          target.push(...(Array.isArray(payload) ? payload : [payload]));
          return { error: null };
        }),
      update: (patch: Row) =>
        makeQuery(tables[table] ?? [], (predicates) => {
          updates.push({ table, patch, predicates: { ...predicates } });
          for (const row of tables[table] ?? []) {
            if (Object.entries(predicates).every(([column, value]) => row[column] === value)) {
              Object.assign(row, patch);
            }
          }
          return { error: null };
        }),
    }),
  };

  return client;
};

describe('R-12 ingestion worker', () => {
  it('parses RSS and Atom feed items', () => {
    const rssItems = parseFeedItems(`
      <rss><channel><item>
        <title><![CDATA[First <b>Story</b>]]></title>
        <description><![CDATA[Summary <script>alert(1)</script> text]]></description>
        <link>https://example.com/first</link>
        <guid>first-guid</guid>
        <pubDate>Sat, 04 Jul 2026 06:00:00 GMT</pubDate>
      </item></channel></rss>
    `);
    expect(rssItems).toEqual([
      {
        title: 'First Story',
        description: 'Summary text',
        url: 'https://example.com/first',
        externalGuid: 'first-guid',
        publishedAt: 'Sat, 04 Jul 2026 06:00:00 GMT',
      },
    ]);

    const atomItems = parseFeedItems(`
      <feed><entry>
        <title>Atom Story</title>
        <summary>Atom summary</summary>
        <link rel="alternate" href="https://example.com/atom" />
        <id>tag:example.com,2026:atom</id>
        <updated>2026-07-04T06:00:00Z</updated>
      </entry></feed>
    `);
    expect(atomItems[0]).toMatchObject({
      title: 'Atom Story',
      description: 'Atom summary',
      url: 'https://example.com/atom',
      externalGuid: 'tag:example.com,2026:atom',
      publishedAt: '2026-07-04T06:00:00Z',
    });
  });

  it('extracts and sanitizes article content from HTML', () => {
    const extracted = extractArticleFromHtml(
      '<html><head><title>Fallback</title></head><body><article><h1>Main Title</h1><p>Hello <strong>reader</strong>.</p><script>alert(1)</script></article></body></html>',
      'https://example.com/story',
    );

    expect(extracted.title).toContain('Main Title');
    expect(extracted.content).toContain('Hello reader.');
    expect(extracted.content).not.toContain('alert');
  });

  it('blocks redirect targets that resolve to private addresses before fetching them', async () => {
    const fetched: string[] = [];
    const response = new Response(null, {
      status: 302,
      headers: { location: 'http://metadata.example/latest/meta-data' },
    });

    await expect(
      fetchWithTimeout('https://safe.example/feed', {
        resolveDns: async (hostname) =>
          hostname === 'safe.example' ? ['93.184.216.34'] : ['169.254.169.254'],
        fetchImpl: async (input) => {
          fetched.push(String(input));
          return response;
        },
      }),
    ).rejects.toBeInstanceOf(SsrfProtectionError);
    expect(fetched).toEqual(['https://safe.example/feed']);
  });

  it('stops reading oversized bodies while streaming', async () => {
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('12345'));
        controller.enqueue(new TextEncoder().encode('67890'));
      },
      cancel() {
        canceled = true;
      },
    });

    await expect(
      fetchTextWithTimeout('https://safe.example/feed', {
        maxBytes: 6,
        resolveDns: async () => ['93.184.216.34'],
        fetchImpl: async () => new Response(stream),
      }),
    ).rejects.toThrow('Fetched content exceeds byte limit');
    expect(canceled).toBe(true);
  });

  it('times out while waiting for a stalled response body', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        return new Promise((resolve) => setTimeout(resolve, 50));
      },
    });

    await expect(
      fetchTextWithTimeout('https://safe.example/feed', {
        timeoutMs: 1,
        resolveDns: async () => ['93.184.216.34'],
        fetchImpl: async () => new Response(stream),
      }),
    ).rejects.toThrow('Fetch timed out while reading response body');
  });

  it('filters duplicate fingerprints without writing duplicate articles', async () => {
    const client = makeClient();
    const fetchImpl = async () =>
      new Response(`
        <rss><channel>
          <item><title>One</title><description>One summary</description><link>https://example.com/one</link><guid>one</guid></item>
          <item><title>One duplicate</title><description>Duplicate</description><link>https://example.com/one</link><guid>one-again</guid></item>
        </channel></rss>
      `);

    const result = await ingestSource(client, SOURCE_ID, {
      resolveDns: async () => ['93.184.216.34'],
      fetchImpl,
    });

    expect(result).toEqual({ inserted: 1, skipped: 1 });
    expect(client.tables.ingested_articles).toHaveLength(1);
    expect(client.tables.source_item_fingerprints).toHaveLength(1);
    expect(client.tables.global_sources[0].failed_fetch_count).toBe(0);
  });

  it('filters legacy article duplicates before attempting inserts', async () => {
    const client = makeClient();
    client.tables.ingested_articles.push({
      source_id: SOURCE_ID,
      external_guid: 'legacy-guid',
      url: 'https://example.com/legacy',
      title: 'Legacy',
      content: 'already present',
    });

    const result = await ingestSource(client, SOURCE_ID, {
      resolveDns: async () => ['93.184.216.34'],
      fetchImpl: async () =>
        new Response(`
          <rss><channel><item><title>Legacy duplicate</title><description>Duplicate</description><link>https://example.com/legacy</link><guid>legacy-guid</guid></item></channel></rss>
        `),
    });

    expect(result).toEqual({ inserted: 0, skipped: 1 });
    expect(client.tables.ingested_articles).toHaveLength(1);
    expect(client.tables.source_item_fingerprints).toHaveLength(0);
  });

  it('normalizes invalid feed dates to null before database writes', async () => {
    const client = makeClient();

    const result = await ingestSource(client, SOURCE_ID, {
      resolveDns: async () => ['93.184.216.34'],
      fetchImpl: async () =>
        new Response(`
          <rss><channel><item><title>No Date</title><description>Summary</description><link>https://example.com/no-date</link><guid>no-date</guid><pubDate>bad external date value</pubDate></item></channel></rss>
        `),
    });

    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(client.tables.ingested_articles[0].published_at).toBeNull();
  });

  it('increments source failures, pauses at 5 failures, and logs an operational event', async () => {
    const client = makeClient({
      source: {
        id: SOURCE_ID,
        url: 'https://feeds.example.com/news.xml',
        type: 'rss',
        status: 'active',
        failed_fetch_count: 4,
      },
    });

    await expect(
      ingestSource(client, SOURCE_ID, {
        resolveDns: async () => ['93.184.216.34'],
        fetchImpl: async () => new Response('no', { status: 503 }),
      }),
    ).rejects.toThrow('fetch failed');

    expect(client.tables.global_sources[0]).toMatchObject({
      failed_fetch_count: 5,
      status: 'paused',
    });
    expect(client.rpcCalls).toContainEqual(
      expect.objectContaining({
        name: 'log_operational_event',
        args: expect.objectContaining({
          p_severity: 'critical',
          p_category: 'source_disabled',
        }),
      }),
    );
  });

  it('runs ingestion before transactional queue acknowledgement', async () => {
    const client = makeClient();
    const handler = createWorkHandler(() => client, {
      ingestion: {
        resolveDns: async () => ['93.184.216.34'],
        fetchImpl: async () =>
          new Response(`
            <rss><channel><item><title>Queued</title><description>Queued summary</description><link>https://example.com/queued</link><guid>queued</guid></item></channel></rss>
          `),
      },
    });

    const response = await handler(AUTH_REQ, {
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'completed', msg_id: 12 });
    expect(client.tables.ingested_articles).toHaveLength(1);
    expect(client.rpcCalls.map((call) => call.name)).toEqual([
      'claim_job',
      'claim_job',
      'claim_job',
      'complete_worker_job',
    ]);
  });

  it('returns and records safe ingestion failure categories', async () => {
    const client = makeClient();
    const handler = createWorkHandler(() => client, {
      ingestion: {
        resolveDns: async () => ['93.184.216.34'],
        fetchImpl: async () => new Response('unsafe external detail', { status: 503 }),
      },
    });

    const response = await handler(AUTH_REQ, {
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ status: 'failed', error: 'fetch failed' });
    expect(client.rpcCalls).toContainEqual(
      expect.objectContaining({
        name: 'log_operational_event',
        args: expect.objectContaining({
          p_context: expect.objectContaining({ error_code: 'fetch_failed' }),
        }),
      }),
    );
    expect(client.rpcCalls).toContainEqual(
      expect.objectContaining({
        name: 'fail_worker_job',
        args: expect.objectContaining({ p_error_message: 'fetch failed' }),
      }),
    );
  });
});
