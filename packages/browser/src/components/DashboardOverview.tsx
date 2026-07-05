import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Session } from '@supabase/supabase-js';
import {
  fetchDigestFeedbackReport,
  type DigestFeedbackReport,
  type DigestSummary,
} from '../lib/digest-feedback.js';
import {
  summarizeDashboardStatus,
  uniqueDashboardSources,
  type DashboardFlowStatus,
  type DashboardSourceStatus,
} from '../lib/dashboard-summary.js';

export type DashboardFixture = {
  flows: DashboardFlowStatus[];
  sources: DashboardSourceStatus[];
  digestReport: DigestFeedbackReport;
};

type FlowSourceLink = {
  global_sources: DashboardSourceStatus | null;
};

type ApiEnvelope<T> = {
  data: T | null;
  error: string | null;
};

type DashboardOverviewProps = {
  session: Session;
  fixture?: DashboardFixture;
  onOpenTab: (tab: 'sources' | 'flows' | 'digests') => void;
};

const defaultDigestReport: DigestFeedbackReport = {
  digests: [],
  feedback_counts: { thumbs_up: 0, thumbs_down: 0, none: 0 },
};

function apiBaseUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/api`;
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.error || envelope.data === null) {
    throw new Error(envelope.error ?? `Request failed with status ${response.status}`);
  }
  return envelope.data;
}

function requestHeaders(session: Session): Record<string, string> {
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    'Content-Type': 'application/json',
  };
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function digestTitle(content: unknown): string {
  if (content && typeof content === 'object' && 'title' in content) {
    const title = (content as { title?: unknown }).title;
    if (typeof title === 'string' && title.trim()) return title;
  }
  return 'Untitled digest';
}

function digestItemCount(digest: DigestSummary): number {
  const content = digest.content;
  if (!content || typeof content !== 'object' || !('sections' in content)) return 0;
  const sections = (content as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return 0;
  return sections.reduce((count, section) => {
    if (section && typeof section === 'object' && 'items' in section) {
      const items = (section as { items?: unknown }).items;
      return count + (Array.isArray(items) ? items.length : 0);
    }
    return count;
  }, 0);
}

function statusTone(status: 'ok' | 'warning' | 'muted') {
  if (status === 'ok') return 'status-chip status-chip--ok';
  if (status === 'warning') return 'status-chip status-chip--warning';
  return 'status-chip';
}

export const dashboardFixture: DashboardFixture = {
  flows: [
    {
      id: 'flow-market',
      name: 'Markets and policy brief',
      is_enabled: true,
      prompt_type: 'predefined',
      next_run_at: '2026-07-06T06:00:00.000Z',
      last_run_at: '2026-07-05T06:05:00.000Z',
    },
    {
      id: 'flow-ai',
      name: 'AI research watch',
      is_enabled: false,
      prompt_type: 'custom',
      next_run_at: '2026-07-06T06:00:00.000Z',
      last_run_at: null,
    },
  ],
  sources: [
    {
      id: 'source-1',
      url: 'https://example.com/markets.xml',
      type: 'rss',
      status: 'active',
      failed_fetch_count: 0,
      last_fetched_at: '2026-07-05T06:02:00.000Z',
    },
    {
      id: 'source-2',
      url: 'https://example.com/research-feed',
      type: 'atom',
      status: 'paused',
      failed_fetch_count: 5,
      last_fetched_at: '2026-07-03T06:00:00.000Z',
    },
  ],
  digestReport: {
    feedback_counts: { thumbs_up: 1, thumbs_down: 0, none: 1 },
    digests: [
      {
        id: 'digest-1',
        flow_id: 'flow-market',
        flow_name: 'Markets and policy brief',
        processing_run_id: 'run-1',
        content: {
          title: 'Morning policy brief',
          language: 'en',
          sections: [
            {
              heading: 'Policy',
              items: [
                {
                  title: 'Central banks hold rates',
                  summary: 'Policy teams signaled a slower path for cuts.',
                  source_urls: ['https://example.com/policy'],
                },
              ],
            },
          ],
        },
        token_usage: 128,
        provider_request_id: 'resp_fixture',
        model: 'gpt-5.4-mini',
        user_feedback: 'thumbs_up',
        created_at: '2026-07-05T06:07:00.000Z',
      },
      {
        id: 'digest-2',
        flow_id: 'flow-ai',
        flow_name: 'AI research watch',
        processing_run_id: 'run-2',
        content: {
          title: 'Research queue update',
          language: 'en',
          sections: [],
        },
        token_usage: 0,
        provider_request_id: null,
        model: 'gpt-5.4-mini',
        user_feedback: 'none',
        created_at: '2026-07-04T06:09:00.000Z',
      },
    ],
  },
};

export default function DashboardOverview({ session, fixture, onOpenTab }: DashboardOverviewProps) {
  const enabled = !fixture;
  const { data: flows = fixture?.flows ?? [], isLoading: flowsLoading } = useQuery<
    DashboardFlowStatus[]
  >({
    queryKey: ['dashboard-flows'],
    enabled,
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl()}/flows`, {
        headers: requestHeaders(session),
      });
      return await readEnvelope<DashboardFlowStatus[]>(response);
    },
  });
  const { data: sources = fixture?.sources ?? [], isLoading: sourcesLoading } = useQuery<
    DashboardSourceStatus[]
  >({
    queryKey: ['dashboard-sources'],
    enabled,
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl()}/sources`, {
        headers: requestHeaders(session),
      });
      const links = await readEnvelope<FlowSourceLink[]>(response);
      return uniqueDashboardSources(links);
    },
  });
  const {
    data: digestReport = fixture?.digestReport ?? defaultDigestReport,
    isLoading: digestLoading,
  } = useQuery<DigestFeedbackReport>({
    queryKey: ['dashboard-digests'],
    enabled,
    queryFn: async () =>
      await fetchDigestFeedbackReport({
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        accessToken: session.access_token,
      }),
  });

  const summary = useMemo(
    () => summarizeDashboardStatus(flows, sources, digestReport),
    [digestReport, flows, sources],
  );
  const { activeFlowCount, totalFlowCount, warningSources, latestDigest } = summary;
  const loading = flowsLoading || sourcesLoading || digestLoading;

  return (
    <section className="dashboard-stack" aria-label="Dashboard overview">
      <div className="overview-hero">
        <div>
          <p className="eyebrow">Production desk</p>
          <h1>Daily intelligence control room</h1>
          <p>
            Scan retained digests, flow timing, and source health before editing the underlying
            panels.
          </p>
        </div>
        <div className="ledger-strip" aria-label="Run ledger">
          <span className={statusTone(latestDigest ? 'ok' : 'muted')}>
            Digest {latestDigest ? 'ready' : 'pending'}
          </span>
          <span className={statusTone(activeFlowCount > 0 ? 'ok' : 'warning')}>
            {activeFlowCount}/{totalFlowCount} flows active
          </span>
          <span className={statusTone(warningSources.length === 0 ? 'ok' : 'warning')}>
            {warningSources.length} source warnings
          </span>
        </div>
      </div>

      {loading ? <div className="panel">Loading dashboard status...</div> : null}

      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-label">Retained digests</span>
          <strong>{digestReport.digests.length}</strong>
          <span>{digestReport.feedback_counts.thumbs_up} rated useful</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Active flows</span>
          <strong>
            {activeFlowCount}/{totalFlowCount}
          </strong>
          <span>Next run {formatDateTime(flows[0]?.next_run_at ?? null)}</span>
        </article>
        <article className="metric-card">
          <span className="metric-label">Source warnings</span>
          <strong>{warningSources.length}</strong>
          <span>{sources.length} linked sources checked</span>
        </article>
      </div>

      <div className="overview-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Digest history</p>
              <h2>Latest retained digest</h2>
            </div>
            <button className="text-button" type="button" onClick={() => onOpenTab('digests')}>
              Open digests
            </button>
          </div>
          {latestDigest ? (
            <div className="digest-brief">
              <h3>{digestTitle(latestDigest.content)}</h3>
              <p>
                {latestDigest.flow_name} · {formatDateTime(latestDigest.created_at)} ·{' '}
                {digestItemCount(latestDigest)} items
              </p>
              <span className="status-chip">Feedback: {latestDigest.user_feedback}</span>
            </div>
          ) : (
            <p className="muted">No retained digest is available yet.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Flow run status</p>
              <h2>Configured flows</h2>
            </div>
            <button className="text-button" type="button" onClick={() => onOpenTab('flows')}>
              Open flows
            </button>
          </div>
          <div className="status-list">
            {flows.slice(0, 4).map((flow) => (
              <div className="status-row" key={flow.id}>
                <div>
                  <strong>{flow.name}</strong>
                  <span>
                    Last {formatDateTime(flow.last_run_at)} · Next{' '}
                    {formatDateTime(flow.next_run_at)}
                  </span>
                </div>
                <span className={statusTone(flow.is_enabled ? 'ok' : 'warning')}>
                  {flow.is_enabled ? 'Enabled' : 'Paused'}
                </span>
              </div>
            ))}
            {flows.length === 0 ? <p className="muted">No flows configured yet.</p> : null}
          </div>
        </article>

        <article className="panel overview-grid__wide">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Source health</p>
              <h2>Warnings and fetch state</h2>
            </div>
            <button className="text-button" type="button" onClick={() => onOpenTab('sources')}>
              Open sources
            </button>
          </div>
          <div className="status-list">
            {(warningSources.length > 0 ? warningSources : sources.slice(0, 3)).map((source) => (
              <div className="status-row" key={source.id}>
                <div>
                  <strong>{source.url}</strong>
                  <span>
                    {source.type.toUpperCase()} · {source.failed_fetch_count} failed fetches · last{' '}
                    {formatDateTime(source.last_fetched_at)}
                  </span>
                </div>
                <span
                  className={statusTone(
                    source.status === 'active' && source.failed_fetch_count < 3 ? 'ok' : 'warning',
                  )}
                >
                  {source.status === 'active' && source.failed_fetch_count < 3
                    ? 'Healthy'
                    : 'Warning'}
                </span>
              </div>
            ))}
            {sources.length === 0 ? <p className="muted">No sources linked yet.</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
