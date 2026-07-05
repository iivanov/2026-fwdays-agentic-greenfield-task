import { describe, expect, it, vi } from 'vitest';
import {
  applyDigestFeedback,
  fetchDigestFeedbackReport,
  toggledFeedback,
  updateDigestFeedback,
  type DigestFeedbackReport,
} from './digest-feedback.js';

const baseOptions = {
  supabaseUrl: 'http://localhost:54321',
  anonKey: 'anon-key',
  accessToken: 'access-token',
};

const report: DigestFeedbackReport = {
  digests: [
    {
      id: 'digest-1',
      flow_id: 'flow-1',
      flow_name: 'Morning',
      processing_run_id: 'run-1',
      content: { title: 'Digest', sections: [] },
      token_usage: 100,
      provider_request_id: 'req-1',
      model: 'gpt-5.4-mini',
      user_feedback: 'none',
      created_at: '2026-07-04T06:00:00Z',
    },
  ],
  feedback_counts: { thumbs_up: 0, thumbs_down: 0, none: 1 },
};

describe('digest feedback browser helpers', () => {
  it('fetches digest feedback report through the authenticated API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: report, error: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const data = await fetchDigestFeedbackReport({ ...baseOptions, fetchImpl });

    expect(data).toEqual(report);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:54321/functions/v1/api/digests',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          apikey: 'anon-key',
        }),
      }),
    );
  });

  it('updates digest feedback and sends only the selected value', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 'digest-1',
            flow_id: 'flow-1',
            user_feedback: 'thumbs_up',
            created_at: '2026-07-04T06:00:00Z',
          },
          error: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const data = await updateDigestFeedback({
      ...baseOptions,
      fetchImpl,
      digestId: 'digest-1',
      userFeedback: 'thumbs_up',
    });

    expect(data.user_feedback).toBe('thumbs_up');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:54321/functions/v1/api/digests/digest-1/feedback',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ user_feedback: 'thumbs_up' }),
      }),
    );
  });

  it('surfaces API error messages for feedback workflows', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: null, error: 'Digest not found or unauthorized access' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(fetchDigestFeedbackReport({ ...baseOptions, fetchImpl })).rejects.toThrow(
      'Digest not found or unauthorized access',
    );
  });

  it('toggles matching thumbs feedback back to none', () => {
    expect(toggledFeedback('thumbs_up', 'thumbs_up')).toBe('none');
    expect(toggledFeedback('thumbs_down', 'thumbs_up')).toBe('thumbs_up');
  });

  it('updates local digest feedback counts after save or clear', () => {
    const rated = applyDigestFeedback(report, 'digest-1', 'thumbs_down');
    expect(rated.digests[0]?.user_feedback).toBe('thumbs_down');
    expect(rated.feedback_counts).toEqual({ thumbs_up: 0, thumbs_down: 1, none: 0 });

    const cleared = applyDigestFeedback(rated, 'digest-1', 'none');
    expect(cleared.digests[0]?.user_feedback).toBe('none');
    expect(cleared.feedback_counts).toEqual({ thumbs_up: 0, thumbs_down: 0, none: 1 });
  });
});
