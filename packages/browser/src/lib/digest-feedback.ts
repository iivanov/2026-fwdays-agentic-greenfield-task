export type DigestFeedbackValue = 'thumbs_up' | 'thumbs_down' | 'none';

export type DigestFeedbackCounts = Record<DigestFeedbackValue, number>;

export type DigestSummary = {
  id: string;
  flow_id: string;
  flow_name: string;
  processing_run_id: string;
  content: unknown;
  token_usage: number;
  provider_request_id: string | null;
  model: string;
  user_feedback: DigestFeedbackValue;
  created_at: string;
};

export type DigestFeedbackReport = {
  digests: DigestSummary[];
  feedback_counts: DigestFeedbackCounts;
};

type ApiEnvelope<T> = {
  data: T | null;
  error: string | null;
};

type FetchLike = typeof fetch;

type DigestApiOptions = {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  fetchImpl?: FetchLike;
};

function apiUrl(supabaseUrl: string, path: string): string {
  const baseUrl = supabaseUrl.replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('Supabase URL is not configured.');
  }
  return `${baseUrl}/functions/v1/api${path}`;
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.error || envelope.data === null) {
    throw new Error(envelope.error ?? `Request failed with status ${response.status}`);
  }
  return envelope.data;
}

function authHeaders(anonKey: string, accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
}

export async function fetchDigestFeedbackReport(
  options: DigestApiOptions,
): Promise<DigestFeedbackReport> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(apiUrl(options.supabaseUrl, '/digests'), {
    method: 'GET',
    headers: authHeaders(options.anonKey, options.accessToken),
  });
  return await readEnvelope<DigestFeedbackReport>(response);
}

export async function updateDigestFeedback(
  options: DigestApiOptions & {
    digestId: string;
    userFeedback: DigestFeedbackValue;
  },
): Promise<Pick<DigestSummary, 'id' | 'flow_id' | 'user_feedback' | 'created_at'>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    apiUrl(options.supabaseUrl, `/digests/${options.digestId}/feedback`),
    {
      method: 'PUT',
      headers: authHeaders(options.anonKey, options.accessToken),
      body: JSON.stringify({ user_feedback: options.userFeedback }),
    },
  );
  return await readEnvelope(response);
}

export function toggledFeedback(
  current: DigestFeedbackValue,
  selected: Exclude<DigestFeedbackValue, 'none'>,
): DigestFeedbackValue {
  return current === selected ? 'none' : selected;
}

export function applyDigestFeedback(
  report: DigestFeedbackReport,
  digestId: string,
  userFeedback: DigestFeedbackValue,
): DigestFeedbackReport {
  const feedbackCounts: DigestFeedbackCounts = { thumbs_up: 0, thumbs_down: 0, none: 0 };
  const digests = report.digests.map((digest) => {
    const nextDigest = digest.id === digestId ? { ...digest, user_feedback: userFeedback } : digest;
    feedbackCounts[nextDigest.user_feedback] += 1;
    return nextDigest;
  });
  return { digests, feedback_counts: feedbackCounts };
}
