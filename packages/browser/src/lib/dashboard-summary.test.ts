import { describe, expect, it } from 'vitest';
import { summarizeDashboardStatus, uniqueDashboardSources } from './dashboard-summary.js';
import { type DigestFeedbackReport } from './digest-feedback.js';

const digestReport: DigestFeedbackReport = {
  feedback_counts: { thumbs_up: 0, thumbs_down: 0, none: 1 },
  digests: [
    {
      id: 'digest-1',
      flow_id: 'flow-1',
      flow_name: 'Policy brief',
      processing_run_id: 'run-1',
      content: { title: 'Morning brief', sections: [] },
      token_usage: 20,
      provider_request_id: 'resp-1',
      model: 'gpt-5.4-mini',
      user_feedback: 'none',
      created_at: '2026-07-05T06:00:00.000Z',
    },
  ],
};

describe('dashboard status summary', () => {
  it('counts active flows and flags paused or repeatedly failing sources', () => {
    const summary = summarizeDashboardStatus(
      [
        {
          id: 'flow-1',
          name: 'Policy brief',
          is_enabled: true,
          prompt_type: 'predefined',
          next_run_at: '2026-07-06T06:00:00.000Z',
          last_run_at: '2026-07-05T06:00:00.000Z',
        },
        {
          id: 'flow-2',
          name: 'Research watch',
          is_enabled: false,
          prompt_type: 'custom',
          next_run_at: null,
          last_run_at: null,
        },
      ],
      [
        {
          id: 'source-1',
          url: 'https://example.com/feed.xml',
          type: 'rss',
          status: 'active',
          failed_fetch_count: 0,
          last_fetched_at: '2026-07-05T06:00:00.000Z',
        },
        {
          id: 'source-2',
          url: 'https://example.com/failing.xml',
          type: 'atom',
          status: 'active',
          failed_fetch_count: 3,
          last_fetched_at: '2026-07-05T06:00:00.000Z',
        },
        {
          id: 'source-3',
          url: 'https://example.com/paused.xml',
          type: 'web',
          status: 'paused',
          failed_fetch_count: 1,
          last_fetched_at: null,
        },
      ],
      digestReport,
    );

    expect(summary.activeFlowCount).toBe(1);
    expect(summary.totalFlowCount).toBe(2);
    expect(summary.warningSources.map((source) => source.id)).toEqual(['source-2', 'source-3']);
    expect(summary.latestDigest?.id).toBe('digest-1');
  });

  it('deduplicates all-flow source links before warning summarization', () => {
    const sources = uniqueDashboardSources([
      {
        global_sources: {
          id: 'source-healthy',
          url: 'https://example.com/healthy.xml',
          type: 'rss',
          status: 'active',
          failed_fetch_count: 0,
          last_fetched_at: '2026-07-05T06:00:00.000Z',
        },
      },
      {
        global_sources: {
          id: 'source-warning',
          url: 'https://example.com/warning.xml',
          type: 'atom',
          status: 'paused',
          failed_fetch_count: 5,
          last_fetched_at: '2026-07-03T06:00:00.000Z',
        },
      },
      {
        global_sources: {
          id: 'source-warning',
          url: 'https://example.com/warning.xml',
          type: 'atom',
          status: 'paused',
          failed_fetch_count: 5,
          last_fetched_at: '2026-07-03T06:00:00.000Z',
        },
      },
    ]);

    const summary = summarizeDashboardStatus([], sources, { ...digestReport, digests: [] });

    expect(sources.map((source) => source.id)).toEqual(['source-healthy', 'source-warning']);
    expect(summary.warningSources.map((source) => source.id)).toEqual(['source-warning']);
  });
});
