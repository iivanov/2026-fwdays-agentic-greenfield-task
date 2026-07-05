import { type DigestFeedbackReport, type DigestSummary } from './digest-feedback.js';

export type DashboardFlowStatus = {
  id: string;
  name: string;
  is_enabled: boolean;
  prompt_type: 'predefined' | 'custom';
  next_run_at: string | null;
  last_run_at: string | null;
};

export type DashboardSourceStatus = {
  id: string;
  url: string;
  type: 'rss' | 'atom' | 'web';
  status: 'active' | 'paused';
  failed_fetch_count: number;
  last_fetched_at: string | null;
};

export type DashboardSummary = {
  activeFlowCount: number;
  totalFlowCount: number;
  warningSources: DashboardSourceStatus[];
  latestDigest: DigestSummary | null;
};

export function uniqueDashboardSources(
  links: Array<{ global_sources: DashboardSourceStatus | null }>,
): DashboardSourceStatus[] {
  const sourcesById = new Map<string, DashboardSourceStatus>();
  for (const link of links) {
    if (link.global_sources) sourcesById.set(link.global_sources.id, link.global_sources);
  }
  return [...sourcesById.values()];
}

export function summarizeDashboardStatus(
  flows: DashboardFlowStatus[],
  sources: DashboardSourceStatus[],
  digestReport: DigestFeedbackReport,
): DashboardSummary {
  return {
    activeFlowCount: flows.filter((flow) => flow.is_enabled).length,
    totalFlowCount: flows.length,
    warningSources: sources.filter(
      (source) => source.status === 'paused' || Number(source.failed_fetch_count) >= 3,
    ),
    latestDigest: digestReport.digests[0] ?? null,
  };
}
