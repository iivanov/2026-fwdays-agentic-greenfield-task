import type { DigestFeedbackValue, DigestFlowSummary, DigestRecord } from './types.ts';

export const feedbackValues = ['thumbs_up', 'thumbs_down', 'none'] as const;

function emptyFeedbackCounts(): Record<DigestFeedbackValue, number> {
  return { thumbs_up: 0, thumbs_down: 0, none: 0 };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function buildDigestReport(digests: DigestRecord[], flows: DigestFlowSummary[]) {
  const flowById = new Map(flows.map((flow) => [flow.id, flow]));
  const counts = emptyFeedbackCounts();

  const items = digests.map((digest) => {
    const feedback = feedbackValues.includes(digest.user_feedback) ? digest.user_feedback : 'none';
    counts[feedback] += 1;
    const flow = flowById.get(digest.flow_id) ?? { id: digest.flow_id, name: 'Unknown flow' };
    return {
      id: digest.id,
      flow_id: digest.flow_id,
      flow_name: flow.name,
      processing_run_id: digest.processing_run_id,
      content: digest.content,
      token_usage: digest.token_usage,
      provider_request_id: digest.provider_request_id,
      model: digest.model,
      user_feedback: feedback,
      created_at: digest.created_at,
    };
  });

  return { digests: items, feedback_counts: counts };
}
