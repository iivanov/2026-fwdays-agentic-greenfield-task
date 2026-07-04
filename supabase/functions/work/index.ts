/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { withSupabase } from '@supabase/server';
import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { decryptPromptTemplate } from '../api/crypto.ts';
import { type DnsResolver, type FetchLike, fetchWithSsrfProtection } from '../api/ssrf.ts';

interface JobPayload {
  type?: string;
  source_id?: string;
  flow_id?: string;
  attempt_id?: string;
  cycle_date?: string;
  simulate_failure?: boolean;
}

interface JobMessage {
  msg_id: string | number;
  read_ct: number;
  enqueued_at: string;
  message: JobPayload;
}

type RpcResult<T = unknown> = { data: T; error: { message: string } | null };

type QueryBuilder = {
  eq: (column: string, value: string) => QueryBuilder;
  order?: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => QueryBuilder;
  limit?: (count: number) => QueryBuilder;
  maybeSingle?: <T = unknown>() => Promise<{ data: T | null; error: { message: string } | null }>;
  then: <TResult1 = { data?: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((
        value: { data?: unknown; error: { message: string } | null },
      ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => PromiseLike<TResult1 | TResult2>;
};

type SupabaseAdmin = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;
  from: (table: string) => {
    select?: (columns?: string) => QueryBuilder;
    insert?: (payload: Record<string, unknown> | Record<string, unknown>[]) => QueryBuilder;
    update: (patch: Record<string, unknown>) => QueryBuilder;
  };
};

type WorkerKind = 'ingestion' | 'processing' | 'delivery';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const getWorkerKind = (queueName: string, message: JobPayload): WorkerKind | null => {
  if (queueName === 'ingestion-queue' || message.type === 'ingestion') return 'ingestion';
  if (queueName === 'processing-queue' || message.type === 'processing') return 'processing';
  if (queueName === 'delivery-queue' || message.type === 'delivery') return 'delivery';
  return null;
};

const sanitizeDlqContext = (queue: string, message: JobPayload) => ({
  queue,
  type: message.type ?? null,
  source_id: message.source_id ?? null,
  flow_id: message.flow_id ?? null,
  attempt_id: message.attempt_id ?? null,
  cycle_date: message.cycle_date ?? null,
});

const assertRpcOk = <T>(result: { data: T; error: { message: string } | null }, label: string) => {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
};

type SourceRecord = {
  id: string;
  url: string;
  type: 'rss' | 'atom' | 'web';
  status?: string | null;
  failed_fetch_count?: number | null;
};

export type ParsedFeedItem = {
  title: string;
  description: string;
  url: string;
  publishedAt: string | null;
  externalGuid: string | null;
};

type IngestedArticle = {
  external_guid: string | null;
  title: string;
  url: string;
  content: string;
  published_at: string | null;
};

type IngestionOptions = {
  fetchImpl?: FetchLike;
  resolveDns?: DnsResolver;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

type ProcessingOptions = {
  fetchImpl?: FetchLike;
  openAiApiKey?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const APPROVED_AI_MODEL = 'gpt-5.4-mini';
const MAX_PROCESSING_CANDIDATES = 50;
const MAX_ARTICLE_CHARS = 2_000;
const MAX_TOTAL_ARTICLE_CHARS = 60_000;
const OPENAI_MAX_OUTPUT_TOKENS = 4_000;
const NEAR_DUPLICATE_THRESHOLD = 0.6;

class IngestionWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'IngestionWorkerError';
  }
}

class ProcessingWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ProcessingWorkerError';
  }
}

const getText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && '#text' in value) {
    return getText((value as Record<string, unknown>)['#text']);
  }
  return '';
};

export const sanitizeText = (value: unknown): string =>
  getText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const getAtomLink = (entry: Record<string, unknown>): string => {
  const links = asArray(entry.link as Record<string, unknown> | string | undefined);
  for (const link of links) {
    if (typeof link === 'string') return link;
    if (link && typeof link === 'object') {
      const linkRecord = link as Record<string, unknown>;
      const rel = getText(linkRecord.rel);
      const href = getText(linkRecord.href);
      if (href && (!rel || rel === 'alternate')) return href;
    }
  }
  return '';
};

export function parseFeedItems(xml: string): ParsedFeedItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
    processEntities: false,
    htmlEntities: false,
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;

  const rssChannel = (parsed.rss as Record<string, unknown> | undefined)?.channel as
    | Record<string, unknown>
    | undefined;
  if (rssChannel) {
    return asArray(
      rssChannel.item as Record<string, unknown> | Record<string, unknown>[] | undefined,
    )
      .map((item) => ({
        title: sanitizeText(item.title),
        description: sanitizeText(item.description),
        url: getText(item.link).trim(),
        publishedAt: getText(item.pubDate).trim() || null,
        externalGuid: getText(item.guid).trim() || null,
      }))
      .filter((item) => item.title && item.url);
  }

  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed) {
    return asArray(feed.entry as Record<string, unknown> | Record<string, unknown>[] | undefined)
      .map((entry) => ({
        title: sanitizeText(entry.title),
        description: sanitizeText(entry.summary ?? entry.content),
        url: getAtomLink(entry).trim(),
        publishedAt: getText(entry.updated ?? entry.published).trim() || null,
        externalGuid: getText(entry.id).trim() || null,
      }))
      .filter((item) => item.title && item.url);
  }

  return [];
}

type ParsedHtmlDocument = {
  querySelector: (selector: string) => { textContent?: string | null } | null;
  body?: { textContent?: string | null } | null;
};

export function extractArticleFromHtml(
  html: string,
  url: string,
): { title: string; content: string } {
  const { document } = parseHTML(html) as unknown as { document: ParsedHtmlDocument };
  const article = new Readability(document as never, { keepClasses: false }).parse();
  const headingTitle = document.querySelector('article h1, h1')?.textContent;
  return {
    title: sanitizeText(
      headingTitle ?? article?.title ?? document.querySelector('title')?.textContent ?? url,
    ),
    content: sanitizeText(article?.textContent ?? document.body?.textContent ?? ''),
  };
}

async function readResponseTextLimited(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      if (signal.aborted) {
        throw new IngestionWorkerError(
          'Fetch timed out while reading response body',
          'fetch_timeout',
        );
      }

      const { done, value } = await new Promise<ReadableStreamReadResult<Uint8Array>>(
        (resolve, reject) => {
          const onAbort = () =>
            reject(
              new IngestionWorkerError(
                'Fetch timed out while reading response body',
                'fetch_timeout',
              ),
            );
          signal.addEventListener('abort', onAbort, { once: true });
          reader.read().then(
            (result) => {
              signal.removeEventListener('abort', onAbort);
              resolve(result);
            },
            (error) => {
              signal.removeEventListener('abort', onAbort);
              reject(error);
            },
          );
        },
      );
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel('response size limit exceeded');
        throw new IngestionWorkerError('Fetched content exceeds byte limit', 'content_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function fetchTextWithTimeout(
  url: string,
  options: IngestionOptions = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetchWithSsrfProtection(
      url,
      { method: 'GET', signal: controller.signal, headers: { Accept: '*/*' } },
      {
        fetchImpl: options.fetchImpl,
        resolveDns: options.resolveDns,
        followRedirects: true,
        maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
      },
    );
    if (!response.ok) {
      throw new IngestionWorkerError('Fetch returned non-success status', 'fetch_failed');
    }
    return await readResponseTextLimited(
      response,
      options.maxBytes ?? DEFAULT_MAX_BYTES,
      controller.signal,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithTimeout(
  url: string,
  options: IngestionOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await fetchWithSsrfProtection(
      url,
      { method: 'GET', signal: controller.signal, headers: { Accept: '*/*' } },
      {
        fetchImpl: options.fetchImpl,
        resolveDns: options.resolveDns,
        followRedirects: true,
        maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const selectSingle = async <T>(
  supabaseAdmin: SupabaseAdmin,
  table: string,
  columns: string,
  predicates: Record<string, string>,
): Promise<T | null> => {
  let query = supabaseAdmin.from(table).select?.(columns);
  if (!query) throw new Error(`Table ${table} does not support select`);
  for (const [column, value] of Object.entries(predicates)) {
    query = query.eq(column, value);
  }
  const result = await query.limit?.(1).maybeSingle?.();
  if (result?.error) throw new Error(result.error.message);
  return (result?.data as T | null) ?? null;
};

const selectRows = async <T>(
  supabaseAdmin: SupabaseAdmin,
  table: string,
  columns: string,
  predicates: Record<string, string> = {},
  options: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
    nullsFirst?: boolean;
  } = {},
): Promise<T[]> => {
  let query = supabaseAdmin.from(table).select?.(columns);
  if (!query) throw new Error(`Table ${table} does not support select`);
  for (const [column, value] of Object.entries(predicates)) {
    query = query.eq(column, value);
  }
  if (options.orderBy && query.order) {
    query = query.order(options.orderBy, {
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst,
    });
  }
  if (options.limit && query.limit) {
    query = query.limit(options.limit);
  }
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return ((result.data as T[] | null | undefined) ?? []) as T[];
};

const insertRows = async (
  supabaseAdmin: SupabaseAdmin,
  table: string,
  payload: Record<string, unknown> | Record<string, unknown>[],
) => {
  const query = supabaseAdmin.from(table).insert?.(payload);
  if (!query) throw new Error(`Table ${table} does not support insert`);
  const result = await query;
  if (result.error) throw new Error(result.error.message);
};

const isUniqueClaimError = (error: unknown): boolean =>
  error instanceof Error &&
  /duplicate key|unique constraint|violates unique/i.test(error.message);

const updateSourceHealth = async (
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  patch: Record<string, unknown>,
) => {
  const { error } = await supabaseAdmin.from('global_sources').update(patch).eq('id', sourceId);
  if (error) throw new Error(`source health update failed: ${error.message}`);
};

async function recordOperationalEvent(
  supabaseAdmin: SupabaseAdmin,
  severity: 'warning' | 'critical',
  category: string,
  key: string,
  context: Record<string, unknown>,
) {
  assertRpcOk(
    await supabaseAdmin.rpc('log_operational_event', {
      p_severity: severity,
      p_category: category,
      p_deduplication_key: key,
      p_context: context,
    }),
    'log operational event failed',
  );
}

const getErrorName = (error: unknown): string =>
  error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name)
    : '';

const safeErrorCode = (error: unknown): string => {
  if (error instanceof IngestionWorkerError) return error.code;
  if (error instanceof ProcessingWorkerError) return error.code;
  if (getErrorName(error) === 'AbortError') return 'fetch_timeout';
  if (getErrorName(error) === 'SsrfProtectionError') return 'ssrf_blocked';
  return 'ingestion_failed';
};

const safeErrorMessage = (error: unknown): string => safeErrorCode(error).replace(/_/g, ' ');

const normalizePublishedAt = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export async function recordSourceFailure(
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  errorCode: string,
) {
  const source = await selectSingle<Pick<SourceRecord, 'failed_fetch_count'>>(
    supabaseAdmin,
    'global_sources',
    'failed_fetch_count',
    { id: sourceId },
  );
  const failedFetchCount = (source?.failed_fetch_count ?? 0) + 1;
  const shouldPause = failedFetchCount >= 5;
  await updateSourceHealth(supabaseAdmin, sourceId, {
    failed_fetch_count: failedFetchCount,
    ...(shouldPause ? { status: 'paused' } : {}),
  });
  await recordOperationalEvent(
    supabaseAdmin,
    shouldPause ? 'critical' : 'warning',
    shouldPause ? 'source_disabled' : 'source_fetch_failed',
    `${shouldPause ? 'source_disabled' : 'source_fetch_failed'}_${sourceId}`,
    {
      source_id: sourceId,
      failed_fetch_count: failedFetchCount,
      error_code: errorCode,
    },
  );
}

async function resetSourceHealth(supabaseAdmin: SupabaseAdmin, sourceId: string) {
  await updateSourceHealth(supabaseAdmin, sourceId, {
    failed_fetch_count: 0,
    last_fetched_at: new Date().toISOString(),
  });
}

export async function filterDuplicateArticle(
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  article: Pick<IngestedArticle, 'url' | 'external_guid'>,
): Promise<{ duplicate: boolean; urlHash: string; guidHash: string | null }> {
  const urlHash = await sha256Hex(article.url);
  const guidHash = article.external_guid ? await sha256Hex(article.external_guid) : null;

  const existingUrl = await selectSingle<{ id: string }>(
    supabaseAdmin,
    'source_item_fingerprints',
    'id',
    { source_id: sourceId, url_hash: urlHash },
  );
  if (existingUrl) return { duplicate: true, urlHash, guidHash };

  const existingArticleUrl = await selectSingle<{ id: string }>(
    supabaseAdmin,
    'ingested_articles',
    'id',
    { source_id: sourceId, url: article.url },
  );
  if (existingArticleUrl) return { duplicate: true, urlHash, guidHash };

  if (guidHash) {
    const existingGuid = await selectSingle<{ id: string }>(
      supabaseAdmin,
      'source_item_fingerprints',
      'id',
      { source_id: sourceId, guid_hash: guidHash },
    );
    if (existingGuid) return { duplicate: true, urlHash, guidHash };

    const existingArticleGuid = await selectSingle<{ id: string }>(
      supabaseAdmin,
      'ingested_articles',
      'id',
      { source_id: sourceId, external_guid: article.external_guid ?? '' },
    );
    if (existingArticleGuid) return { duplicate: true, urlHash, guidHash };
  }

  return { duplicate: false, urlHash, guidHash };
}

export async function ingestSource(
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  options: IngestionOptions = {},
): Promise<{ inserted: number; skipped: number }> {
  const source = await selectSingle<SourceRecord>(
    supabaseAdmin,
    'global_sources',
    'id,url,type,status,failed_fetch_count',
    { id: sourceId },
  );
  if (!source) throw new Error(`Source not found: ${sourceId}`);
  if (source.status === 'paused') throw new Error(`Source is paused: ${sourceId}`);

  try {
    const body = await fetchTextWithTimeout(source.url, options);

    let articles: IngestedArticle[];
    if (source.type === 'web') {
      const extracted = extractArticleFromHtml(body, source.url);
      if (!extracted.title || !extracted.content) {
        throw new Error('Article extraction produced no content');
      }
      articles = [{
        external_guid: null,
        title: extracted.title,
        url: source.url,
        content: extracted.content,
        published_at: null,
      }];
    } else {
      articles = parseFeedItems(body).map((item) => ({
        external_guid: item.externalGuid,
        title: item.title,
        url: item.url,
        content: item.description || item.title,
        published_at: normalizePublishedAt(item.publishedAt),
      }));
    }

    let inserted = 0;
    let skipped = 0;
    for (const article of articles) {
      const duplicate = await filterDuplicateArticle(supabaseAdmin, sourceId, article);
      if (duplicate.duplicate) {
        skipped += 1;
        continue;
      }

      await insertRows(supabaseAdmin, 'ingested_articles', {
        source_id: sourceId,
        ...article,
      });
      await insertRows(supabaseAdmin, 'source_item_fingerprints', {
        source_id: sourceId,
        url_hash: duplicate.urlHash,
        guid_hash: duplicate.guidHash,
      });
      inserted += 1;
    }

    await resetSourceHealth(supabaseAdmin, sourceId);
    return { inserted, skipped };
  } catch (err: unknown) {
    const errorCode = safeErrorCode(err);
    await recordSourceFailure(supabaseAdmin, sourceId, errorCode);
    throw new IngestionWorkerError(safeErrorMessage(err), errorCode);
  }
}

type ProcessingFlowRecord = {
  id: string;
  user_id: string;
  name: string;
  ai_model: string;
  prompt_type: 'predefined' | 'custom';
  prompt_template: string | null;
  is_enabled: boolean;
};

type ProcessingRunRecord = {
  id: string;
  flow_id: string;
  cycle_date: string;
  status: string;
};

type FlowSourceRecord = {
  source_id: string;
};

type FlowArticleRecord = {
  article_id: string;
  processing_run_id: string;
  status: 'claimed' | 'included' | 'filtered';
};

export type ProcessingArticleCandidate = {
  id: string;
  source_id: string;
  title: string;
  url: string;
  content: string;
  published_at: string | null;
  created_at?: string | null;
};

export type GroupedArticle = {
  representative: ProcessingArticleCandidate;
  articles: ProcessingArticleCandidate[];
  text: string;
  sourceUrls: string[];
};

type StructuredDigest = {
  title: string;
  language: string;
  sections: Array<{
    heading: string;
    items: Array<{
      title: string;
      summary: string;
      source_urls: string[];
    }>;
  }>;
};

type OpenAiResponseBody = {
  id?: unknown;
  model?: unknown;
  output?: unknown;
  usage?: {
    total_tokens?: unknown;
    input_tokens?: unknown;
    output_tokens?: unknown;
  };
};

const normalizeWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

export function createNGramSet(text: string, size = 3): Set<string> {
  const words = normalizeWords(text);
  if (words.length === 0) return new Set();
  if (words.length < size) return new Set([words.join(' ')]);
  const grams = new Set<string>();
  for (let index = 0; index <= words.length - size; index += 1) {
    grams.add(words.slice(index, index + size).join(' '));
  }
  return grams;
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const truncateUnicode = (value: string, maxChars: number): string =>
  Array.from(value).slice(0, maxChars).join('');

const articleSortTime = (
  article: Pick<ProcessingArticleCandidate, 'published_at' | 'created_at'>,
) => {
  const value = article.published_at ?? article.created_at ?? '';
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export function groupNearDuplicateArticles(
  articles: ProcessingArticleCandidate[],
  threshold = NEAR_DUPLICATE_THRESHOLD,
): GroupedArticle[] {
  const groups: Array<GroupedArticle & { shingles: Set<string> }> = [];

  for (const article of articles) {
    const articleText = `${article.title}\n${article.content}`;
    const shingles = createNGramSet(articleText);
    const existing = groups.find((group) =>
      jaccardSimilarity(group.shingles, shingles) >= threshold
    );

    if (existing) {
      existing.articles.push(article);
      existing.sourceUrls = Array.from(new Set([...existing.sourceUrls, article.url]));
      continue;
    }

    groups.push({
      representative: article,
      articles: [article],
      text: article.content,
      sourceUrls: [article.url],
      shingles,
    });
  }

  return groups.map((group) => ({
    representative: group.representative,
    articles: group.articles,
    text: group.text,
    sourceUrls: group.sourceUrls,
  }));
}

export function applyProcessingBudgets(
  groups: GroupedArticle[],
  perArticleChars = MAX_ARTICLE_CHARS,
  totalChars = MAX_TOTAL_ARTICLE_CHARS,
): GroupedArticle[] {
  const budgeted: GroupedArticle[] = [];
  let remaining = totalChars;

  for (const group of groups) {
    if (remaining <= 0) break;
    const text = truncateUnicode(
      group.representative.content,
      Math.min(perArticleChars, remaining),
    );
    if (!text) continue;
    budgeted.push({ ...group, text });
    remaining -= Array.from(text).length;
  }

  return budgeted;
}

const digestJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'language', 'sections'],
  properties: {
    title: { type: 'string' },
    language: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'items'],
        properties: {
          heading: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'summary', 'source_urls'],
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                source_urls: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function buildOpenAiDigestRequest(
  flow: Pick<ProcessingFlowRecord, 'name' | 'ai_model'>,
  groups: GroupedArticle[],
  customPrompt: string | null,
) {
  const articlePayload = groups.map((group, index) => ({
    group: index + 1,
    title: group.representative.title,
    source_urls: group.sourceUrls,
    near_duplicate_count: group.articles.length,
    text: group.text,
  }));

  const instructions = [
    'Create a concise personalized news digest from the provided article groups.',
    'Merge near-duplicate groups into one story item and cite all useful source URLs.',
    'Return only the strict JSON schema fields.',
    customPrompt
      ? `User preference: ${customPrompt}`
      : 'Use the default balanced news digest style.',
  ].join('\n');

  return {
    model: flow.ai_model || APPROVED_AI_MODEL,
    instructions,
    input: JSON.stringify({
      flow_name: flow.name,
      articles: articlePayload,
    }),
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'news_digest',
        strict: true,
        schema: digestJsonSchema,
      },
    },
  };
}

const extractOutputText = (body: OpenAiResponseBody): string => {
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'output_text' &&
        typeof (part as { text?: unknown }).text === 'string'
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  return '';
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export function parseStructuredDigest(value: unknown): StructuredDigest {
  if (!value || typeof value !== 'object') {
    throw new ProcessingWorkerError('AI response did not match digest schema', 'ai_schema_invalid');
  }
  const digest = value as StructuredDigest;
  if (
    typeof digest.title !== 'string' ||
    typeof digest.language !== 'string' ||
    !Array.isArray(digest.sections)
  ) {
    throw new ProcessingWorkerError('AI response did not match digest schema', 'ai_schema_invalid');
  }
  for (const section of digest.sections) {
    if (
      !section ||
      typeof section !== 'object' ||
      typeof section.heading !== 'string' ||
      !Array.isArray(section.items)
    ) {
      throw new ProcessingWorkerError(
        'AI response did not match digest schema',
        'ai_schema_invalid',
      );
    }
    for (const item of section.items) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.title !== 'string' ||
        typeof item.summary !== 'string' ||
        !isStringArray(item.source_urls)
      ) {
        throw new ProcessingWorkerError(
          'AI response did not match digest schema',
          'ai_schema_invalid',
        );
      }
    }
  }
  return digest;
}

export function parseOpenAiDigestResponse(body: OpenAiResponseBody): {
  digest: StructuredDigest;
  providerRequestId: string | null;
  model: string;
  tokenUsage: number;
} {
  const text = extractOutputText(body);
  if (!text) {
    throw new ProcessingWorkerError(
      'AI response did not include structured output',
      'ai_schema_invalid',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProcessingWorkerError('AI response was not valid JSON', 'ai_schema_invalid');
  }

  const tokenUsage = Number(body.usage?.total_tokens ?? 0);
  return {
    digest: parseStructuredDigest(parsed),
    providerRequestId: typeof body.id === 'string' ? body.id : null,
    model: typeof body.model === 'string' ? body.model : APPROVED_AI_MODEL,
    tokenUsage: Number.isFinite(tokenUsage) && tokenUsage >= 0 ? tokenUsage : 0,
  };
}

async function callOpenAiDigest(
  requestBody: ReturnType<typeof buildOpenAiDigestRequest>,
  apiKey: string,
  options: ProcessingOptions,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      throw new ProcessingWorkerError('AI provider request failed', 'ai_provider_failed');
    }
    return parseOpenAiDigestResponse(await response.json() as OpenAiResponseBody);
  } catch (error: unknown) {
    if (error instanceof ProcessingWorkerError) throw error;
    if (getErrorName(error) === 'AbortError') {
      throw new ProcessingWorkerError('AI provider request timed out', 'ai_provider_timeout');
    }
    throw new ProcessingWorkerError('AI provider request failed', 'ai_provider_failed');
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiDigestWithSchemaRepair(
  requestBody: ReturnType<typeof buildOpenAiDigestRequest>,
  apiKey: string,
  options: ProcessingOptions,
) {
  try {
    return await callOpenAiDigest(requestBody, apiKey, options);
  } catch (error: unknown) {
    if (!(error instanceof ProcessingWorkerError) || error.code !== 'ai_schema_invalid') {
      throw error;
    }
  }

  return await callOpenAiDigest(
    {
      ...requestBody,
      instructions:
        `${requestBody.instructions}\n\nRepair attempt: the previous model output did not match the required JSON schema. Return only valid JSON that exactly matches the schema.`,
    },
    apiKey,
    options,
  );
}

const updateProcessingRun = async (
  supabaseAdmin: SupabaseAdmin,
  flowId: string,
  cycleDate: string,
  patch: Record<string, unknown>,
) => {
  const { error } = await supabaseAdmin
    .from('processing_runs')
    .update(patch)
    .eq('flow_id', flowId)
    .eq('cycle_date', cycleDate);
  if (error) throw new Error(`processing run update failed: ${error.message}`);
};

async function selectFlowCandidateArticles(
  supabaseAdmin: SupabaseAdmin,
  sourceIds: string[],
): Promise<ProcessingArticleCandidate[]> {
  const rows: ProcessingArticleCandidate[] = [];
  for (const sourceId of sourceIds) {
    rows.push(
      ...await selectRows<ProcessingArticleCandidate>(
        supabaseAdmin,
        'ingested_articles',
        'id,source_id,title,url,content,published_at,created_at',
        { source_id: sourceId },
        {
          orderBy: 'published_at',
          ascending: false,
          nullsFirst: false,
        },
      ),
    );
  }
  return rows
    .filter((article) => article.id && article.title && article.url && article.content)
    .sort((left, right) => articleSortTime(right) - articleSortTime(left));
}

async function claimArticlesForRun(
  supabaseAdmin: SupabaseAdmin,
  flowId: string,
  processingRunId: string,
  candidates: ProcessingArticleCandidate[],
): Promise<ProcessingArticleCandidate[]> {
  const claimed: ProcessingArticleCandidate[] = [];
  for (const article of candidates) {
    try {
      await insertRows(supabaseAdmin, 'flow_articles', {
        flow_id: flowId,
        article_id: article.id,
        processing_run_id: processingRunId,
        status: 'claimed',
      });
      claimed.push(article);
    } catch (error: unknown) {
      if (!isUniqueClaimError(error)) throw error;
    }
  }
  return claimed;
}

async function markExistingDigestArticlesIncluded(
  supabaseAdmin: SupabaseAdmin,
  flowId: string,
  processingRunId: string,
  digestId: string,
) {
  const { error } = await supabaseAdmin
    .from('flow_articles')
    .update({ status: 'included', digest_id: digestId })
    .eq('flow_id', flowId)
    .eq('processing_run_id', processingRunId);
  if (error) throw new Error(`flow article retry repair failed: ${error.message}`);
}

async function persistProcessingDigest(
  supabaseAdmin: SupabaseAdmin,
  payload: {
    digestId: string;
    flowId: string;
    processingRunId: string;
    content: StructuredDigest;
    tokenUsage: number;
    providerRequestId: string | null;
    model: string;
  },
): Promise<string> {
  const result = await supabaseAdmin.rpc('persist_processing_digest', {
    p_digest_id: payload.digestId,
    p_flow_id: payload.flowId,
    p_processing_run_id: payload.processingRunId,
    p_content: payload.content,
    p_token_usage: payload.tokenUsage,
    p_provider_request_id: payload.providerRequestId,
    p_model: payload.model,
  });
  return assertRpcOk(result, 'persist processing digest failed') as string;
}

export async function processFlow(
  supabaseAdmin: SupabaseAdmin,
  flowId: string,
  cycleDate: string,
  options: ProcessingOptions = {},
): Promise<{ outcome: 'completed' | 'no_content'; articleCount: number; digestId?: string }> {
  const flow = await selectSingle<ProcessingFlowRecord>(
    supabaseAdmin,
    'processing_flows',
    'id,user_id,name,ai_model,prompt_type,prompt_template,is_enabled',
    { id: flowId },
  );
  if (!flow) throw new ProcessingWorkerError('Processing flow not found', 'flow_not_found');
  if (!flow.is_enabled) {
    throw new ProcessingWorkerError('Processing flow disabled', 'flow_disabled');
  }
  if (flow.ai_model !== APPROVED_AI_MODEL) {
    throw new ProcessingWorkerError(
      'Processing flow model is not approved',
      'ai_model_not_allowed',
    );
  }

  const processingRun = await selectSingle<ProcessingRunRecord>(
    supabaseAdmin,
    'processing_runs',
    'id,flow_id,cycle_date,status',
    { flow_id: flowId, cycle_date: cycleDate },
  );
  if (!processingRun) {
    throw new ProcessingWorkerError('Processing run not found', 'processing_run_not_found');
  }

  const sourceRows = await selectRows<FlowSourceRecord>(
    supabaseAdmin,
    'flow_sources',
    'source_id',
    { flow_id: flowId },
  );
  const sourceIds = sourceRows.map((row) => row.source_id).filter(Boolean);
  if (sourceIds.length === 0) {
    await updateProcessingRun(supabaseAdmin, flowId, cycleDate, {
      status: 'no_content',
      completed_at: new Date().toISOString(),
      error_code: null,
    });
    return { outcome: 'no_content', articleCount: 0 };
  }

  const flowArticles = await selectRows<FlowArticleRecord>(
    supabaseAdmin,
    'flow_articles',
    'article_id,processing_run_id,status',
    { flow_id: flowId },
  );
  const existingDigest = await selectSingle<{ id: string }>(
    supabaseAdmin,
    'processed_digests',
    'id',
    { processing_run_id: processingRun.id },
  );
  if (existingDigest) {
    await markExistingDigestArticlesIncluded(
      supabaseAdmin,
      flowId,
      processingRun.id,
      existingDigest.id,
    );
    return {
      outcome: 'completed',
      articleCount: flowArticles.filter((row) => row.processing_run_id === processingRun.id)
        .length,
      digestId: existingDigest.id,
    };
  }

  const allArticles = await selectFlowCandidateArticles(supabaseAdmin, sourceIds);
  const currentRunClaimIds = new Set(
    flowArticles
      .filter((row) => row.processing_run_id === processingRun.id && row.status === 'claimed')
      .map((row) => row.article_id),
  );

  let claimedArticles = allArticles.filter((article) => currentRunClaimIds.has(article.id));
  if (claimedArticles.length === 0) {
    const alreadyClaimed = new Set(flowArticles.map((row) => row.article_id));
    const candidates = allArticles
      .filter((article) => !alreadyClaimed.has(article.id))
      .slice(0, MAX_PROCESSING_CANDIDATES);
    claimedArticles = await claimArticlesForRun(
      supabaseAdmin,
      flowId,
      processingRun.id,
      candidates,
    );
  }

  if (claimedArticles.length === 0) {
    await updateProcessingRun(supabaseAdmin, flowId, cycleDate, {
      status: 'no_content',
      completed_at: new Date().toISOString(),
      error_code: null,
    });
    return { outcome: 'no_content', articleCount: 0 };
  }

  const customPrompt = flow.prompt_type === 'custom'
    ? await decryptPromptTemplate(flow.prompt_template)
    : null;
  const grouped = applyProcessingBudgets(groupNearDuplicateArticles(claimedArticles));
  if (grouped.length === 0) {
    await updateProcessingRun(supabaseAdmin, flowId, cycleDate, {
      status: 'no_content',
      completed_at: new Date().toISOString(),
      error_code: null,
    });
    return { outcome: 'no_content', articleCount: 0 };
  }

  const apiKey = options.openAiApiKey;
  if (!apiKey) throw new ProcessingWorkerError('OpenAI API key not configured', 'ai_key_missing');

  const aiResult = await callOpenAiDigestWithSchemaRepair(
    buildOpenAiDigestRequest(flow, grouped, customPrompt),
    apiKey,
    options,
  );
  const digestId = crypto.randomUUID();
  const persistedDigestId = await persistProcessingDigest(supabaseAdmin, {
    digestId,
    flowId,
    processingRunId: processingRun.id,
    content: aiResult.digest,
    tokenUsage: aiResult.tokenUsage,
    providerRequestId: aiResult.providerRequestId,
    model: aiResult.model,
  });

  return {
    outcome: 'completed',
    articleCount: claimedArticles.length,
    digestId: persistedDigestId,
  };
}

const markProcessing = async (
  supabaseAdmin: SupabaseAdmin,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
) => {
  if (kind === 'ingestion' && message.source_id) {
    const { error } = await supabaseAdmin
      .from('source_fetch_runs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('source_id', message.source_id)
      .eq('cycle_date', cycleDate);
    if (error) throw new Error(`mark ingestion processing failed: ${error.message}`);
  } else if (kind === 'processing' && message.flow_id) {
    const { error } = await supabaseAdmin
      .from('processing_runs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('flow_id', message.flow_id)
      .eq('cycle_date', cycleDate);
    if (error) throw new Error(`mark processing run failed: ${error.message}`);
  } else if (kind === 'delivery' && message.attempt_id) {
    const { error } = await supabaseAdmin
      .from('digest_delivery_attempts')
      .update({
        status: 'sending',
        locked_at: new Date().toISOString(),
        attempted_at: new Date().toISOString(),
      })
      .eq('id', message.attempt_id);
    if (error) throw new Error(`mark delivery sending failed: ${error.message}`);
  }
};

const completeJob = async (
  supabaseAdmin: SupabaseAdmin,
  activeQueue: string,
  msgId: string | number,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('complete_worker_job', {
      p_queue_name: activeQueue,
      p_msg_id: msgId,
      p_job_type: kind,
      p_source_id: message.source_id ?? null,
      p_flow_id: message.flow_id ?? null,
      p_attempt_id: message.attempt_id ?? null,
      p_cycle_date: cycleDate,
    }),
    'complete worker job failed',
  );
};

const failJob = async (
  supabaseAdmin: SupabaseAdmin,
  kind: WorkerKind,
  message: JobPayload,
  cycleDate: string,
  errorMessage: string,
) => {
  assertRpcOk(
    await supabaseAdmin.rpc('fail_worker_job', {
      p_job_type: kind,
      p_error_message: errorMessage,
      p_source_id: message.source_id ?? null,
      p_flow_id: message.flow_id ?? null,
      p_attempt_id: message.attempt_id ?? null,
      p_cycle_date: cycleDate,
    }),
    'record worker failure failed',
  );
};

type CreateAdminClient = (url: string, serviceKey: string) => SupabaseAdmin;
type WorkHandlerOptions = {
  ingestion?: IngestionOptions;
  processing?: ProcessingOptions;
};

export const createWorkHandler =
  (createAdminClient: CreateAdminClient, options: WorkHandlerOptions = {}) =>
  async (req: Request, envs: Record<string, string>) => {
    const authHeader = req.headers.get('Authorization') ?? '';
    const serviceKey = envs.SUPABASE_SERVICE_ROLE_KEY ?? '';

    if (!serviceKey) return json({ error: 'Unauthorized: Service key not configured' }, 401);
    if (authHeader !== `Bearer ${serviceKey}` && authHeader !== serviceKey) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseAdmin = createAdminClient(envs.SUPABASE_URL ?? '', serviceKey);

    const queues = ['delivery-queue', 'processing-queue', 'ingestion-queue'];
    let claimedJob: JobMessage | null = null;
    let activeQueue = '';

    for (const queueName of queues) {
      const { data, error } = await supabaseAdmin.rpc('claim_job', {
        queue_name: queueName,
        lease_seconds: 300,
      });
      if (error) {
        return json({ status: 'claim_failed', queue: queueName, error: error.message }, 500);
      }
      const jobs = data as JobMessage[] | null;
      if (jobs && jobs.length > 0) {
        claimedJob = jobs[0];
        activeQueue = queueName;
        break;
      }
    }

    if (!claimedJob) return json({ status: 'idle', message: 'No jobs in queue' });

    const { msg_id: msgId, read_ct: readCount, message } = claimedJob;
    const kind = getWorkerKind(activeQueue, message);
    const cycleDate = message.cycle_date || new Date().toISOString().split('T')[0];

    if (!kind) return json({ status: 'failed', msg_id: msgId, error: 'Unsupported job type' }, 500);

    if (readCount > 5) {
      const { error } = await supabaseAdmin.rpc('archive_exhausted_worker_job', {
        p_queue_name: activeQueue,
        p_msg_id: msgId,
        p_event_key: `msg_failed_dlq_${activeQueue}_${msgId}`,
        p_context: sanitizeDlqContext(activeQueue, message),
      });
      if (error) {
        return json({ status: 'dlq_archive_failed', msg_id: msgId, error: error.message }, 500);
      }
      return json({ status: 'dlq_archived', msg_id: msgId, reason: 'Retry count exceeded 5' });
    }

    try {
      await markProcessing(supabaseAdmin, kind, message, cycleDate);

      if (message.simulate_failure) throw new Error('Simulated worker execution failure');
      if (kind === 'ingestion') {
        if (!message.source_id) throw new Error('Ingestion job missing source_id');
        await ingestSource(supabaseAdmin, message.source_id, options.ingestion);
      } else if (kind === 'processing') {
        if (!message.flow_id) throw new Error('Processing job missing flow_id');
        await processFlow(supabaseAdmin, message.flow_id, cycleDate, {
          ...options.processing,
          openAiApiKey: options.processing?.openAiApiKey ?? envs.OPENAI_API_KEY,
        });
      }

      await completeJob(supabaseAdmin, activeQueue, msgId, kind, message, cycleDate);

      return json({ status: 'completed', msg_id: msgId });
    } catch (err: unknown) {
      const errMsg = err instanceof IngestionWorkerError || err instanceof ProcessingWorkerError
        ? safeErrorMessage(err)
        : err instanceof Error
        ? err.message
        : 'Unknown execution failure';

      try {
        await failJob(supabaseAdmin, kind, message, cycleDate, errMsg);
      } catch (failureRecordErr: unknown) {
        const recordError = failureRecordErr instanceof Error
          ? failureRecordErr.message
          : 'Unknown failure recording error';
        return json({
          status: 'failed',
          msg_id: msgId,
          error: errMsg,
          failure_record_error: recordError,
        }, 500);
      }

      return json({ status: 'failed', msg_id: msgId, error: errMsg }, 500);
    }
  };

export const workHandler = createWorkHandler((url, serviceKey) =>
  createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as SupabaseAdmin
);

export default {
  fetch: withSupabase({ auth: ['secret'] }, async (req) => {
    try {
      const envs = {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY') ?? '',
      };
      return await workHandler(req, envs);
    } catch (err: unknown) {
      return json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
    }
  }),
};
