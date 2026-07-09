export type ChannelType = 'in-app' | 'email' | 'telegram' | 'slack' | 'webhook';

export type AuthenticatedApiUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

export type ProcessingFlowRecord = {
  prompt_type?: 'predefined' | 'custom' | string | null;
  prompt_template?: string | null;
  [key: string]: unknown;
};

export type DigestFeedbackValue = 'thumbs_up' | 'thumbs_down' | 'none';

export type DigestFlowSummary = {
  id: string;
  name: string;
};

export type DigestRecord = {
  id: string;
  flow_id: string;
  processing_run_id: string;
  content: unknown;
  token_usage: number;
  provider_request_id: string | null;
  model: string;
  user_feedback: DigestFeedbackValue;
  created_at: string;
};

export type ApiHandlerContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin?: any;
  resolveDns?: import('./ssrf.ts').DnsResolver;
};
