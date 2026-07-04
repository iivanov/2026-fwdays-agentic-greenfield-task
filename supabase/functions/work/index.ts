/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />
import { withSupabase } from '@supabase/server';
import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
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
  limit?: (count: number) => QueryBuilder;
  maybeSingle?: <T = unknown>() => Promise<{ data: T | null; error: { message: string } | null }>;
  then: <TResult1 = { error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
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

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

class IngestionWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'IngestionWorkerError';
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
      }

      await completeJob(supabaseAdmin, activeQueue, msgId, kind, message, cycleDate);

      return json({ status: 'completed', msg_id: msgId });
    } catch (err: unknown) {
      const errMsg = err instanceof IngestionWorkerError
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
      };
      return await workHandler(req, envs);
    } catch (err: unknown) {
      return json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
    }
  }),
};
