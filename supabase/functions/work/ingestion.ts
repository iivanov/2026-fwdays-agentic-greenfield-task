import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { fetchWithSsrfProtection } from '../api/ssrf.ts';
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_REDIRECTS, DEFAULT_TIMEOUT_MS } from './constants.ts';
import { insertRows, selectSingle } from './db.ts';
import { IngestionWorkerError, safeErrorCode, safeErrorMessage } from './errors.ts';
import { recordOperationalEvent } from './alerting.ts';
import { sha256Hex } from './crypto-utils.ts';
import type {
  IngestedArticle,
  IngestionOptions,
  ParsedFeedItem,
  SourceRecord,
  SupabaseAdmin,
} from './types.ts';

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

const normalizePublishedAt = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const updateSourceHealth = async (
  supabaseAdmin: SupabaseAdmin,
  sourceId: string,
  patch: Record<string, unknown>,
) => {
  const { error } = await supabaseAdmin.from('global_sources').update(patch).eq('id', sourceId);
  if (error) throw new Error(`source health update failed: ${error.message}`);
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
