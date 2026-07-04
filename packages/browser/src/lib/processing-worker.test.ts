import { describe, expect, it } from 'vitest';
import {
  applyProcessingBudgets,
  createWorkHandler,
  groupNearDuplicateArticles,
  parseOpenAiDigestResponse,
  processFlow,
  type ProcessingArticleCandidate,
} from '../../../../supabase/functions/work/index.ts';

const SERVICE_KEY = 'test-service-key';
const FLOW_ID = '33333333-3333-4333-9333-333333333333';
const SOURCE_ID = '44444444-4444-4444-9444-444444444444';
const RUN_ID = '55555555-5555-4555-9555-555555555555';
const CYCLE_DATE = '2026-07-04';
const AUTH_REQ = new Request('http://localhost/functions/v1/work', {
  headers: { Authorization: `Bearer ${SERVICE_KEY}` },
});

type Row = Record<string, unknown>;
type FakeTables = Record<string, Row[]>;
type RpcCall = { name: string; args?: Record<string, unknown> };

const makeQuery = (
  rows: Row[],
  execute: (predicates: Record<string, string>) => {
    data?: unknown;
    error: { message: string } | null;
  },
) => {
  const predicates: Record<string, string> = {};
  let limitCount: number | null = null;
  let orderBy: { column: string; ascending: boolean } | null = null;

  const filteredRows = () => {
    let result = rows.filter((row) =>
      Object.entries(predicates).every(([column, value]) => row[column] === value),
    );
    if (orderBy) {
      result = [...result].sort((left, right) => {
        const leftTime = new Date(String(left[orderBy.column] ?? '')).getTime();
        const rightTime = new Date(String(right[orderBy.column] ?? '')).getTime();
        const leftValue = Number.isNaN(leftTime) ? 0 : leftTime;
        const rightValue = Number.isNaN(rightTime) ? 0 : rightTime;
        return orderBy.ascending ? leftValue - rightValue : rightValue - leftValue;
      });
    }
    return limitCount === null ? result : result.slice(0, limitCount);
  };

  const query = {
    eq: (column: string, value: string) => {
      predicates[column] = value;
      return query;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      orderBy = { column, ascending: options?.ascending ?? true };
      return query;
    },
    limit: (count: number) => {
      limitCount = count;
      return query;
    },
    maybeSingle: async () => ({
      data: filteredRows()[0] ?? null,
      error: null,
    }),
    then: (
      resolve: (value: { data?: unknown; error: { message: string } | null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(execute(predicates)).then(resolve, reject),
  };
  return query;
};

const makeClient = (options: { articles?: Row[]; claimedArticleIds?: string[] } = {}) => {
  const tables: FakeTables = {
    processing_flows: [
      {
        id: FLOW_ID,
        user_id: 'user-1',
        name: 'Daily Engineering',
        ai_model: 'gpt-5.4-mini',
        prompt_type: 'predefined',
        prompt_template: null,
        is_enabled: true,
      },
    ],
    processing_runs: [
      {
        id: RUN_ID,
        flow_id: FLOW_ID,
        cycle_date: CYCLE_DATE,
        status: 'pending',
      },
    ],
    flow_sources: [{ flow_id: FLOW_ID, source_id: SOURCE_ID }],
    flow_articles: (options.claimedArticleIds ?? []).map((articleId) => ({
      flow_id: FLOW_ID,
      article_id: articleId,
      processing_run_id: 'older-run',
      status: 'included',
    })),
    ingested_articles: options.articles ?? [],
    processed_digests: [],
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
            args?.queue_name === 'processing-queue'
              ? [
                  {
                    msg_id: 21,
                    read_ct: 1,
                    enqueued_at: new Date().toISOString(),
                    message: { type: 'processing', flow_id: FLOW_ID, cycle_date: CYCLE_DATE },
                  },
                ]
              : [],
          error: null,
        };
      }
      if (name === 'complete_worker_job') {
        const run = tables.processing_runs[0];
        if (run.status !== 'no_content') run.status = 'completed';
        run.completed_at = new Date().toISOString();
      }
      if (name === 'fail_worker_job') {
        tables.processing_runs[0].status = 'failed';
        tables.processing_runs[0].error_code = args?.p_error_message;
      }
      if (name === 'persist_processing_digest') {
        const digestId = String(args?.p_digest_id);
        const existingDigest = tables.processed_digests.find(
          (row) => row.processing_run_id === args?.p_processing_run_id,
        );
        if (!existingDigest) {
          tables.processed_digests.push({
            id: digestId,
            flow_id: args?.p_flow_id,
            processing_run_id: args?.p_processing_run_id,
            content: args?.p_content,
            token_usage: args?.p_token_usage,
            provider_request_id: args?.p_provider_request_id,
            model: args?.p_model,
          });
        }
        for (const row of tables.flow_articles) {
          if (
            row.flow_id === args?.p_flow_id &&
            row.processing_run_id === args?.p_processing_run_id
          ) {
            row.status = 'included';
            row.digest_id = existingDigest?.id ?? digestId;
          }
        }
        return { data: existingDigest?.id ?? digestId, error: null };
      }
      return { data: {}, error: null };
    },
    from: (table: string) => ({
      select: () =>
        makeQuery(tables[table] ?? [], () => ({
          data: tables[table] ?? [],
          error: null,
        })),
      insert: (payload: Row | Row[]) =>
        makeQuery(tables[table] ?? [], () => {
          const target = tables[table] ?? (tables[table] = []);
          const rows = Array.isArray(payload) ? payload : [payload];
          if (table === 'flow_articles') {
            for (const row of rows) {
              if (
                target.some(
                  (existing) =>
                    existing.flow_id === row.flow_id && existing.article_id === row.article_id,
                )
              ) {
                return { error: { message: 'duplicate key value violates unique constraint' } };
              }
            }
          }
          target.push(...rows);
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

const article = (
  id: string,
  title: string,
  content: string,
  publishedAt: string,
): ProcessingArticleCandidate => ({
  id,
  source_id: SOURCE_ID,
  title,
  url: `https://example.com/${id}`,
  content,
  published_at: publishedAt,
  created_at: publishedAt,
});

const openAiDigestResponse = () =>
  new Response(
    JSON.stringify({
      id: 'resp_test_123',
      model: 'gpt-5.4-mini',
      usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                title: 'Engineering Digest',
                language: 'en',
                sections: [
                  {
                    heading: 'Top stories',
                    items: [
                      {
                        title: 'TypeScript shipped',
                        summary: 'A concise summary.',
                        source_urls: ['https://example.com/a1'],
                      },
                    ],
                  },
                ],
              }),
            },
          ],
        },
      ],
    }),
  );

describe('R-13 AI processing worker', () => {
  it('groups near-duplicates and applies article/total text budgets', () => {
    const baseText = 'OpenAI released a strict structured output feature for response schemas.';
    const groups = groupNearDuplicateArticles([
      article('a1', 'Structured outputs', baseText, '2026-07-04T08:00:00Z'),
      article('a2', 'Structured outputs', baseText, '2026-07-04T08:01:00Z'),
      article(
        'a3',
        'Database news',
        'Postgres queues improved background processing.',
        '2026-07-04T08:02:00Z',
      ),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].sourceUrls).toEqual(['https://example.com/a1', 'https://example.com/a2']);

    const budgeted = applyProcessingBudgets(groups, 12, 20);
    expect(budgeted.map((group) => group.text)).toEqual(['OpenAI relea', 'Postgres']);
  });

  it('marks processing runs no_content and creates no digest when there are no new articles', async () => {
    const client = makeClient();
    const handler = createWorkHandler(() => client, {
      processing: { openAiApiKey: 'test-openai-key' },
    });

    const response = await handler(AUTH_REQ, {
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      OPENAI_API_KEY: 'test-openai-key',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'completed', msg_id: 21 });
    expect(client.tables.processing_runs[0].status).toBe('no_content');
    expect(client.tables.processed_digests).toHaveLength(0);
    expect(client.rpcCalls.map((call) => call.name)).toEqual([
      'claim_job',
      'claim_job',
      'complete_worker_job',
    ]);
  });

  it('claims only new articles, calls Responses with strict schema, and persists usage', async () => {
    let openAiRequest: Record<string, unknown> | null = null;
    const client = makeClient({
      claimedArticleIds: ['old'],
      articles: [
        article('old', 'Old', 'Already processed.', '2026-07-04T06:00:00Z'),
        article(
          'a1',
          'TypeScript shipped',
          'TypeScript released safer compiler checks.',
          '2026-07-04T09:00:00Z',
        ),
        article(
          'a2',
          'TypeScript shipped',
          'TypeScript released safer compiler checks.',
          '2026-07-04T09:01:00Z',
        ),
      ],
    });

    const result = await processFlow(client, FLOW_ID, CYCLE_DATE, {
      openAiApiKey: 'test-openai-key',
      fetchImpl: async (_input, init) => {
        openAiRequest = JSON.parse(String(init?.body));
        return openAiDigestResponse();
      },
    });

    expect(result.outcome).toBe('completed');
    expect(client.tables.flow_articles).toHaveLength(3);
    expect(
      client.tables.flow_articles.filter((row) => row.processing_run_id === RUN_ID),
    ).toHaveLength(2);
    expect(openAiRequest).toMatchObject({
      model: 'gpt-5.4-mini',
      max_output_tokens: 4000,
      store: false,
      text: {
        format: {
          type: 'json_schema',
          strict: true,
        },
      },
    });
    const requestInput = JSON.parse(String(openAiRequest?.input)) as {
      articles: Array<{ near_duplicate_count: number; source_urls: string[] }>;
    };
    expect(requestInput.articles[0]).toMatchObject({
      near_duplicate_count: 2,
      source_urls: ['https://example.com/a2', 'https://example.com/a1'],
    });
    expect(client.rpcCalls).toContainEqual(
      expect.objectContaining({
        name: 'persist_processing_digest',
        args: expect.objectContaining({
          p_flow_id: FLOW_ID,
          p_processing_run_id: RUN_ID,
          p_token_usage: 150,
          p_provider_request_id: 'resp_test_123',
          p_model: 'gpt-5.4-mini',
        }),
      }),
    );
    expect(client.tables.processed_digests[0]).toMatchObject({
      flow_id: FLOW_ID,
      processing_run_id: RUN_ID,
      token_usage: 150,
      provider_request_id: 'resp_test_123',
      model: 'gpt-5.4-mini',
    });
    expect(client.tables.flow_articles.filter((row) => row.digest_id)).toHaveLength(2);
  });

  it('filters already-claimed articles before applying the 50-article cap', async () => {
    const claimedArticles = Array.from({ length: 50 }, (_, index) =>
      article(
        `claimed-${index}`,
        `Claimed ${index}`,
        `Already processed newer article ${index}.`,
        `2026-07-04T10:${String(index).padStart(2, '0')}:00Z`,
      ),
    );
    const olderUnclaimed = article(
      'older-unclaimed',
      'Older unclaimed',
      'This older article should still be processed after the newer claimed items are filtered.',
      '2026-07-04T08:00:00Z',
    );
    let openAiRequest: Record<string, unknown> | null = null;
    const client = makeClient({
      claimedArticleIds: claimedArticles.map((candidate) => candidate.id),
      articles: [...claimedArticles, olderUnclaimed],
    });

    const result = await processFlow(client, FLOW_ID, CYCLE_DATE, {
      openAiApiKey: 'test-openai-key',
      fetchImpl: async (_input, init) => {
        openAiRequest = JSON.parse(String(init?.body));
        return openAiDigestResponse();
      },
    });

    expect(result.outcome).toBe('completed');
    expect(
      client.tables.flow_articles.some(
        (row) => row.article_id === 'older-unclaimed' && row.processing_run_id === RUN_ID,
      ),
    ).toBe(true);
    const requestInput = JSON.parse(String(openAiRequest?.input)) as {
      articles: Array<{ title: string; source_urls: string[] }>;
    };
    expect(requestInput.articles).toHaveLength(1);
    expect(requestInput.articles[0]).toMatchObject({
      title: 'Older unclaimed',
      source_urls: ['https://example.com/older-unclaimed'],
    });
  });

  it('reuses an existing digest on queue-ack retry instead of overwriting the run as no_content', async () => {
    const client = makeClient({
      articles: [
        article(
          'a1',
          'Already digested',
          'This article was included before acknowledgement failed.',
          '2026-07-04T09:00:00Z',
        ),
      ],
    });
    client.tables.flow_articles.push({
      flow_id: FLOW_ID,
      article_id: 'a1',
      processing_run_id: RUN_ID,
      status: 'included',
      digest_id: 'digest-existing',
    });
    client.tables.processed_digests.push({
      id: 'digest-existing',
      flow_id: FLOW_ID,
      processing_run_id: RUN_ID,
      content: { title: 'Existing', language: 'en', sections: [] },
      token_usage: 42,
      provider_request_id: 'resp_existing',
      model: 'gpt-5.4-mini',
    });

    const result = await processFlow(client, FLOW_ID, CYCLE_DATE, {
      openAiApiKey: 'test-openai-key',
      fetchImpl: async () => {
        throw new Error('OpenAI should not be called when digest already exists');
      },
    });

    expect(result).toEqual({
      outcome: 'completed',
      articleCount: 1,
      digestId: 'digest-existing',
    });
    expect(client.tables.processing_runs[0].status).toBe('pending');
    expect(client.tables.processed_digests).toHaveLength(1);
    expect(client.tables.flow_articles[0]).toMatchObject({
      status: 'included',
      digest_id: 'digest-existing',
    });
  });

  it('repairs incomplete existing digest links before acknowledging a retry', async () => {
    const client = makeClient({
      articles: [
        article(
          'a1',
          'Already digested',
          'Digest persisted but link update failed before retry.',
          '2026-07-04T09:00:00Z',
        ),
      ],
    });
    client.tables.flow_articles.push({
      flow_id: FLOW_ID,
      article_id: 'a1',
      processing_run_id: RUN_ID,
      status: 'claimed',
      digest_id: null,
    });
    client.tables.processed_digests.push({
      id: 'digest-existing',
      flow_id: FLOW_ID,
      processing_run_id: RUN_ID,
      content: { title: 'Existing', language: 'en', sections: [] },
      token_usage: 42,
      provider_request_id: 'resp_existing',
      model: 'gpt-5.4-mini',
    });

    const result = await processFlow(client, FLOW_ID, CYCLE_DATE, {
      openAiApiKey: 'test-openai-key',
      fetchImpl: async () => {
        throw new Error('OpenAI should not be called when digest already exists');
      },
    });

    expect(result.digestId).toBe('digest-existing');
    expect(client.tables.flow_articles[0]).toMatchObject({
      status: 'included',
      digest_id: 'digest-existing',
    });
  });

  it('makes one schema repair attempt before persisting a digest', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const client = makeClient({
      articles: [
        article(
          'a1',
          'Repair needed',
          'The first structured output is malformed.',
          '2026-07-04T09:00:00Z',
        ),
      ],
    });

    const result = await processFlow(client, FLOW_ID, CYCLE_DATE, {
      openAiApiKey: 'test-openai-key',
      fetchImpl: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)));
        if (requests.length === 1) {
          return new Response(
            JSON.stringify({
              id: 'resp_bad',
              model: 'gpt-5.4-mini',
              usage: { total_tokens: 12 },
              output: [
                {
                  type: 'message',
                  content: [
                    { type: 'output_text', text: JSON.stringify({ title: 'Missing fields' }) },
                  ],
                },
              ],
            }),
          );
        }
        return openAiDigestResponse();
      },
    });

    expect(result.outcome).toBe('completed');
    expect(requests).toHaveLength(2);
    expect(String(requests[1].instructions)).toContain('Repair attempt');
    expect(client.tables.processed_digests[0]).toMatchObject({
      provider_request_id: 'resp_test_123',
      token_usage: 150,
    });
  });

  it('parses structured Responses output and rejects malformed schema', () => {
    const parsed = parseOpenAiDigestResponse({
      id: 'resp_test',
      model: 'gpt-5.4-mini',
      usage: { total_tokens: 9 },
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({ title: 'Digest', language: 'en', sections: [] }),
            },
          ],
        },
      ],
    });
    expect(parsed).toMatchObject({ providerRequestId: 'resp_test', tokenUsage: 9 });

    expect(() =>
      parseOpenAiDigestResponse({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify({ title: 'Missing fields' }) }],
          },
        ],
      }),
    ).toThrow('AI response did not match digest schema');
  });

  it('records sanitized provider failure categories', async () => {
    const client = makeClient({
      articles: [
        article('a1', 'Provider fail', 'Provider failure content.', '2026-07-04T09:00:00Z'),
      ],
    });
    const handler = createWorkHandler(() => client, {
      processing: {
        openAiApiKey: 'test-openai-key',
        fetchImpl: async () => new Response('provider body with details', { status: 503 }),
      },
    });

    const response = await handler(AUTH_REQ, {
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      OPENAI_API_KEY: 'test-openai-key',
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ status: 'failed', error: 'ai provider failed' });
    expect(client.rpcCalls).toContainEqual(
      expect.objectContaining({
        name: 'fail_worker_job',
        args: expect.objectContaining({ p_error_message: 'ai provider failed' }),
      }),
    );
  });
});
