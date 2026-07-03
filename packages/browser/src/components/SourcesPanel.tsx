import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';

interface GlobalSource {
  id: string;
  url: string;
  type: 'rss' | 'atom' | 'web';
  status: 'active' | 'paused';
  failed_fetch_count: number;
  last_fetched_at: string | null;
}

interface FlowSourceLink {
  flow_id: string;
  global_sources: GlobalSource;
}

interface ProcessingFlow {
  id: string;
  name: string;
  frequency: 'daily';
  is_enabled: boolean;
}

export default function SourcesPanel({ session }: { session: Session | null }) {
  const queryClient = useQueryClient();
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState<'rss' | 'atom' | 'web'>('rss');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const apiEndpoint = `${supabaseUrl}/functions/v1/api/sources`;

  // 1. Fetch user's processing flows
  const { data: flows, isLoading: flowsLoading } = useQuery<ProcessingFlow[]>({
    queryKey: ['flows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_flows')
        .select('id, name, frequency, is_enabled')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Automatically select the first flow when flows are loaded
  useEffect(() => {
    if (flows && flows.length > 0 && !selectedFlowId) {
      setSelectedFlowId(flows[0].id);
    }
  }, [flows, selectedFlowId]);

  // 2. Fetch sources connected to the selected flow
  const { data: connectedSources, isLoading: sourcesLoading } = useQuery<FlowSourceLink[]>({
    queryKey: ['flow-sources', selectedFlowId],
    enabled: !!selectedFlowId,
    queryFn: async () => {
      const token = session?.access_token;
      const res = await fetch(`${apiEndpoint}?flow_id=${selectedFlowId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || 'Failed to load sources.');
      }

      const body = await res.json();
      return body.data;
    },
  });

  // 3. Create default flow mutation
  const createDefaultFlowMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('processing_flows')
        .insert({
          name: 'My Tech Daily Briefing',
          user_id: session?.user?.id,
          frequency: 'daily',
          is_enabled: true,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      showNotification('success', 'Default flow created! You can now add sources.');
    },
    onError: (err: Error) => {
      showNotification('error', err.message || 'Failed to create default flow.');
    },
  });

  // 4. Add source connection mutation
  const addSourceMutation = useMutation({
    mutationFn: async (payload: { url: string; type: 'rss' | 'atom' | 'web'; flow_id: string }) => {
      const token = session?.access_token;
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || 'Failed to connect news feed source.');
      }

      const body = await res.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-sources', selectedFlowId] });
      setSourceUrl('');
      showNotification('success', 'News feed source connected successfully!');
    },
    onError: (err: Error) => {
      showNotification('error', err.message || 'Failed to connect source.');
    },
  });

  // 5. Delete source connection mutation
  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const token = session?.access_token;
      const res = await fetch(apiEndpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          flow_id: selectedFlowId,
          source_id: sourceId,
        }),
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || 'Failed to disconnect source.');
      }

      const body = await res.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-sources', selectedFlowId] });
      showNotification('success', 'Source disconnected successfully.');
    },
    onError: (err: Error) => {
      showNotification('error', err.message || 'Failed to disconnect source.');
    },
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim()) return;
    addSourceMutation.mutate({
      url: sourceUrl.trim(),
      type: sourceType,
      flow_id: selectedFlowId,
    });
  };

  if (flowsLoading) {
    return (
      <div style={{ color: 'hsl(var(--text-secondary))' }}>Loading your processing flows...</div>
    );
  }

  // If no flows exist, offer to auto-create a default one
  if (!flows || flows.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}
      >
        <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>No Ingestion Flows Configured</h3>
        <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '24px' }}>
          You need at least one ingestion flow before you can connect news feeds, URLs, or custom
          source lists.
        </p>
        <button
          onClick={() => createDefaultFlowMutation.mutate()}
          disabled={createDefaultFlowMutation.isPending}
          style={{
            padding: '12px 28px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent-gradient)',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {createDefaultFlowMutation.isPending ? 'Creating flow...' : 'Create Daily Briefing Flow'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Title */}
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Ingestion Sources</h1>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>
          Link automated RSS/Atom feeds or direct article URLs to your daily ingestion flows.
        </p>
      </div>

      {notification && (
        <div
          style={{
            background:
              notification.type === 'success'
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${notification.type === 'success' ? 'hsl(var(--success))' : 'hsl(var(--danger))'}`,
            padding: '16px',
            borderRadius: '10px',
            color: notification.type === 'success' ? 'hsl(142, 70%, 75%)' : 'hsl(346, 80%, 75%)',
            fontSize: '0.95rem',
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
        }}
      >
        {/* Left Side: Selector & Add Source Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Flow Selector */}
          <section className="glass-panel" style={{ padding: '30px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                color: 'hsl(var(--text-secondary))',
                marginBottom: '8px',
              }}
            >
              Active Ingestion Flow
            </label>
            <select
              value={selectedFlowId}
              onChange={(e) => setSelectedFlowId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border-color))',
                background: 'hsl(var(--bg-secondary))',
                fontSize: '0.95rem',
              }}
            >
              {flows.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.frequency})
                </option>
              ))}
            </select>
          </section>

          {/* Add Source Form */}
          <section
            className="glass-panel"
            style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <h3 style={{ fontSize: '1.2rem' }}>Connect New Source</h3>
            <form
              onSubmit={handleAddSource}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: 'hsl(var(--text-secondary))',
                    marginBottom: '6px',
                  }}
                >
                  Feed or Article URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/feed.xml"
                  required
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border-color))',
                    background: 'hsl(var(--bg-secondary))',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    color: 'hsl(var(--text-secondary))',
                    marginBottom: '6px',
                  }}
                >
                  Source Format Type
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {(['rss', 'atom', 'web'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSourceType(type)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: `1px solid ${sourceType === type ? 'hsl(var(--accent-primary))' : 'hsl(var(--border-color))'}`,
                        background: sourceType === type ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={addSourceMutation.isPending}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent-gradient)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  marginTop: '8px',
                }}
              >
                {addSourceMutation.isPending ? 'Validating & Adding...' : 'Link Ingestion Source'}
              </button>
            </form>
          </section>
        </div>

        {/* Right Side: Connected Sources List */}
        <section
          className="glass-panel"
          style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Linked Sources</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
              Active news feeds currently ingest stories daily into this flow.
            </p>
          </div>

          {sourcesLoading ? (
            <div style={{ color: 'hsl(var(--text-secondary))' }}>Loading connected sources...</div>
          ) : !connectedSources || connectedSources.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: 'hsl(var(--text-secondary))',
                fontStyle: 'italic',
                fontSize: '0.9rem',
              }}
            >
              No sources connected to this flow yet. Link one on the left panel!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {connectedSources.map(({ global_sources: src }) => {
                if (!src) return null;
                return (
                  <div
                    key={src.id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid hsl(var(--border-color))',
                      background: 'rgba(255, 255, 255, 0.01)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 500,
                          wordBreak: 'break-all',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {src.url}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            background: 'rgba(255, 255, 255, 0.08)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: 'hsl(var(--text-secondary))',
                          }}
                        >
                          {src.type}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color:
                              src.status === 'active'
                                ? 'hsl(var(--success))'
                                : 'hsl(var(--danger))',
                          }}
                        >
                          ● {src.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSourceMutation.mutate(src.id)}
                      disabled={deleteSourceMutation.isPending}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid hsl(var(--border-color))',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(var(--danger))';
                        e.currentTarget.style.color = 'hsl(var(--danger))';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
                        e.currentTarget.style.color = 'inherit';
                      }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
