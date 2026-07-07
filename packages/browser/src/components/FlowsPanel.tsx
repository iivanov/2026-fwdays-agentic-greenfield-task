import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Session } from '@supabase/supabase-js';

interface ProcessingFlow {
  id: string;
  name: string;
  frequency: 'daily';
  ai_model: string;
  prompt_type: 'predefined' | 'custom';
  prompt_template: string | null;
  is_enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  created_at: string;
}

export default function FlowsPanel({ session }: { session: Session | null }) {
  const queryClient = useQueryClient();
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  // Form states for creating a flow
  const [name, setName] = useState('');
  const [promptType, setPromptType] = useState<'predefined' | 'custom'>('predefined');
  const [promptTemplate, setPromptTemplate] = useState('');

  // Form states for editing a flow
  const [editName, setEditName] = useState('');
  const [editPromptType, setEditPromptType] = useState<'predefined' | 'custom'>('predefined');
  const [editPromptTemplate, setEditPromptTemplate] = useState('');

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const apiEndpoint = `${supabaseUrl}/functions/v1/api/flows`;

  // 1. Fetch user's flows
  const { data: flows, isLoading } = useQuery<ProcessingFlow[]>({
    queryKey: ['flows'],
    queryFn: async () => {
      const token = session?.access_token;
      const res = await fetch(apiEndpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || 'Failed to load flows.');
      }

      const body = await res.json();
      return body.data;
    },
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // 2. Create flow mutation
  const createFlowMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      prompt_type: 'predefined' | 'custom';
      prompt_template?: string;
    }) => {
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
        throw new Error(errPayload.error || 'Failed to create briefing flow.');
      }

      const body = await res.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setName('');
      setPromptTemplate('');
      setPromptType('predefined');
      showNotification('success', 'Briefing flow created successfully!');
    },
    onError: (err: Error) => {
      showNotification('error', err.message);
    },
  });

  // 3. Update flow settings mutation
  const updateFlowMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      name?: string;
      prompt_type?: 'predefined' | 'custom';
      prompt_template?: string | null;
      is_enabled?: boolean;
    }) => {
      const token = session?.access_token;
      const res = await fetch(`${apiEndpoint}/${payload.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || 'Failed to update briefing flow.');
      }

      const body = await res.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setEditingFlowId(null);
      showNotification('success', 'Flow settings updated successfully.');
    },
    onError: (err: Error) => {
      showNotification('error', err.message);
    },
  });

  // 4. Delete flow mutation
  const deleteFlowMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = session?.access_token;
      const res = await fetch(`${apiEndpoint}/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || 'Failed to delete briefing flow.');
      }

      const body = await res.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      showNotification('success', 'Briefing flow removed successfully.');
    },
    onError: (err: Error) => {
      showNotification('error', err.message);
    },
  });

  const handleCreateFlow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createFlowMutation.mutate({
      name: name.trim(),
      prompt_type: promptType,
      prompt_template: promptType === 'custom' ? promptTemplate.trim() : undefined,
    });
  };

  const handleStartEditing = (flow: ProcessingFlow) => {
    setEditingFlowId(flow.id);
    setEditName(flow.name);
    setEditPromptType(flow.prompt_type);
    setEditPromptTemplate(flow.prompt_template || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    updateFlowMutation.mutate({
      id,
      name: editName.trim(),
      prompt_type: editPromptType,
      prompt_template: editPromptType === 'custom' ? editPromptTemplate.trim() : null,
    });
  };

  const toggleEnabled = (flow: ProcessingFlow) => {
    updateFlowMutation.mutate({
      id: flow.id,
      is_enabled: !flow.is_enabled,
    });
  };

  if (isLoading) {
    return (
      <div style={{ color: 'hsl(var(--text-secondary))' }}>Loading briefing configurations...</div>
    );
  }

  const quotaReached = flows ? flows.length >= 5 : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Ingestion Flows</h1>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>
          Configure subject-matter channels (max 5) with custom prompt structures and scheduling
          status.
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
          gap: '32px',
        }}
      >
        {/* Left Side: Create / Configuration Area */}
        <section className="glass-panel" style={{ padding: '30px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '16px' }}>Create Ingestion Flow</h3>
          {quotaReached ? (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid hsl(var(--warning) || #f59e0b)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                color: 'hsl(38, 90%, 75%)',
                fontSize: '0.9rem',
              }}
            >
              <strong>Quota Limit Reached:</strong> You have configured the maximum limit of 5
              briefing flows. Remove an existing flow to setup a new briefing channel.
            </div>
          ) : null}

          <form
            onSubmit={handleCreateFlow}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: '6px',
                }}
              >
                Flow Name
              </label>
              <input
                type="text"
                placeholder="e.g. Artificial Intelligence Brief"
                required
                disabled={quotaReached}
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                  fontSize: '0.85rem',
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: '6px',
                }}
              >
                AI Summary Prompt Format
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  disabled={quotaReached}
                  onClick={() => setPromptType('predefined')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${promptType === 'predefined' ? 'hsl(var(--accent-primary))' : 'hsl(var(--border-color))'}`,
                    background:
                      promptType === 'predefined' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Standard Briefing
                </button>
                <button
                  type="button"
                  disabled={quotaReached}
                  onClick={() => setPromptType('custom')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${promptType === 'custom' ? 'hsl(var(--accent-primary))' : 'hsl(var(--border-color))'}`,
                    background: promptType === 'custom' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Custom Persona
                </button>
              </div>
            </div>

            {promptType === 'custom' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    color: 'hsl(var(--text-secondary))',
                    marginBottom: '6px',
                  }}
                >
                  Custom System Persona Instructions
                </label>
                <textarea
                  placeholder="e.g. Summarize as bullet points. Focus heavily on TypeScript, Next.js, and web dev. Translate all headlines into Pirate speak."
                  required
                  rows={4}
                  disabled={quotaReached}
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border-color))',
                    background: 'hsl(var(--bg-secondary))',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={quotaReached || createFlowMutation.isPending}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: quotaReached ? 'rgba(255,255,255,0.04)' : 'var(--accent-gradient)',
                color: quotaReached ? 'hsl(var(--text-secondary))' : '#ffffff',
                fontWeight: '600',
                cursor: quotaReached ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                marginTop: '8px',
              }}
            >
              {createFlowMutation.isPending ? 'Creating...' : 'Initialize briefing flow'}
            </button>
          </form>
        </section>

        {/* Right Side: Flow List */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.3rem' }}>Active Configurations ({flows?.length || 0}/5)</h3>

          {!flows || flows.length === 0 ? (
            <div
              className="glass-panel"
              style={{
                padding: '40px',
                textAlign: 'center',
                color: 'hsl(var(--text-secondary))',
                fontStyle: 'italic',
              }}
            >
              No processing briefing channels configured. Create one using the form.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {flows.map((flow) => {
                const isEditing = editingFlowId === flow.id;
                return (
                  <div
                    key={flow.id}
                    className="glass-panel"
                    style={{
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      borderLeft: `4px solid ${flow.is_enabled ? 'hsl(var(--accent-primary))' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    {isEditing ? (
                      // Editing Layout
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid hsl(var(--border-color))',
                            background: 'hsl(var(--bg-secondary))',
                            fontSize: '0.95rem',
                          }}
                        />

                        <div style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
                          <button
                            type="button"
                            onClick={() => setEditPromptType('predefined')}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '6px',
                              border: `1px solid ${editPromptType === 'predefined' ? 'hsl(var(--accent-primary))' : 'hsl(var(--border-color))'}`,
                              background:
                                editPromptType === 'predefined'
                                  ? 'rgba(99, 102, 241, 0.1)'
                                  : 'transparent',
                              fontSize: '0.8rem',
                            }}
                          >
                            Predefined
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditPromptType('custom')}
                            style={{
                              flex: 1,
                              padding: '6px',
                              borderRadius: '6px',
                              border: `1px solid ${editPromptType === 'custom' ? 'hsl(var(--accent-primary))' : 'hsl(var(--border-color))'}`,
                              background:
                                editPromptType === 'custom'
                                  ? 'rgba(99, 102, 241, 0.1)'
                                  : 'transparent',
                              fontSize: '0.8rem',
                            }}
                          >
                            Custom Persona
                          </button>
                        </div>

                        {editPromptType === 'custom' && (
                          <textarea
                            value={editPromptTemplate}
                            onChange={(e) => setEditPromptTemplate(e.target.value)}
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid hsl(var(--border-color))',
                              background: 'hsl(var(--bg-secondary))',
                              fontSize: '0.9rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                            }}
                          />
                        )}

                        <div
                          style={{
                            display: 'flex',
                            gap: '10px',
                            justifyContent: 'flex-end',
                            marginTop: '8px',
                          }}
                        >
                          <button
                            onClick={() => setEditingFlowId(null)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid hsl(var(--border-color))',
                              background: 'transparent',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(flow.id)}
                            disabled={updateFlowMutation.isPending}
                            style={{
                              padding: '6px 16px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'var(--accent-gradient)',
                              color: '#ffffff',
                              fontWeight: '600',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Read Only Layout
                      <>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '16px',
                          }}
                        >
                          <div>
                            <h4
                              style={{
                                fontSize: '1.15rem',
                                fontWeight: '600',
                                marginBottom: '4px',
                              }}
                            >
                              {flow.name}
                            </h4>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  background: 'rgba(255,255,255,0.08)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {flow.ai_model}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  background: 'rgba(255,255,255,0.08)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  textTransform: 'capitalize',
                                }}
                              >
                                Prompt: {flow.prompt_type}
                              </span>
                            </div>
                          </div>

                          {/* Toggle switch */}
                          <button
                            onClick={() => toggleEnabled(flow)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '20px',
                              border: 'none',
                              background: flow.is_enabled
                                ? 'rgba(16, 185, 129, 0.2)'
                                : 'rgba(255,255,255,0.05)',
                              color: flow.is_enabled
                                ? 'hsl(var(--success))'
                                : 'hsl(var(--text-secondary))',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            {flow.is_enabled ? 'Active' : 'Disabled'}
                          </button>
                        </div>

                        {flow.prompt_type === 'custom' && flow.prompt_template && (
                          <div
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: '6px',
                              padding: '10px 14px',
                              fontSize: '0.85rem',
                              color: 'hsl(var(--text-secondary))',
                              fontStyle: 'italic',
                            }}
                          >
                            "{flow.prompt_template}"
                          </div>
                        )}

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.8rem',
                            color: 'hsl(var(--text-secondary))',
                            borderTop: '1px solid hsl(var(--border-color))',
                            paddingTop: '12px',
                            marginTop: '4px',
                          }}
                        >
                          <span>
                            Next Run:{' '}
                            {new Date(flow.next_run_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            UTC
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleStartEditing(flow)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'hsl(var(--accent-primary))',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Are you sure you want to delete the flow "${flow.name}"? This will unlink all feed sources.`,
                                  )
                                ) {
                                  deleteFlowMutation.mutate(flow.id);
                                }
                              }}
                              disabled={deleteFlowMutation.isPending}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'hsl(var(--danger))',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </>
                    )}
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
