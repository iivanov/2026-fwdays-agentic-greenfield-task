import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Session } from '@supabase/supabase-js';

interface DeliveryChannel {
  id: string;
  type: 'in-app' | 'email' | 'telegram' | 'slack' | 'webhook';
  status: 'pending' | 'active' | 'disabled';
  config: Record<string, string>;
  verified_at: string | null;
  created_at: string;
}

interface ProcessingFlow {
  id: string;
  name: string;
}

export default function DeliveryPanel({ session }: { session: Session | null }) {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<'email' | 'slack' | 'telegram' | 'webhook'>(
    'email',
  );

  // Form states
  const [emailAddress, setEmailAddress] = useState('');
  const [slackUrl, setSlackUrl] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [genericWebhookUrl, setGenericWebhookUrl] = useState('');

  const [linkingChannelId, setLinkingChannelId] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const apiEndpoint = `${supabaseUrl}/functions/v1/api/channels`;

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Fetch user's delivery channels
  const { data: channels, isLoading: channelsLoading } = useQuery<DeliveryChannel[]>({
    queryKey: ['delivery-channels'],
    queryFn: async () => {
      const token = session?.access_token;
      const res = await fetch(apiEndpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load delivery channels');
      }
      const body = await res.json();
      return body.data;
    },
  });

  // 2. Fetch user's flows for linking configurations
  const { data: flows } = useQuery<ProcessingFlow[]>({
    queryKey: ['flows'],
    queryFn: async () => {
      const token = session?.access_token;
      const res = await fetch(`${supabaseUrl}/functions/v1/api/flows`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load flows');
      }
      const body = await res.json();
      return body.data;
    },
  });

  // 3. Create delivery channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async (payload: { type: string; config: Record<string, string> }) => {
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
        const err = await res.json();
        throw new Error(err.error || 'Failed to save delivery channel');
      }
      const body = await res.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-channels'] });
      // Reset form states
      setEmailAddress('');
      setSlackUrl('');
      setTelegramBotToken('');
      setTelegramChatId('');
      setGenericWebhookUrl('');
      showNotification('success', 'Delivery channel registered successfully.');
    },
    onError: (err: Error) => {
      showNotification('error', err.message);
    },
  });

  // 4. Verify channel mutation
  const verifyChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = session?.access_token;
      const res = await fetch(`${apiEndpoint}/${id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to verify channel');
      }
      const body = await res.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-channels'] });
      showNotification('success', 'Delivery channel verified successfully.');
    },
    onError: (err: Error) => {
      showNotification('error', err.message);
    },
  });

  // 5. Delete channel mutation
  const deleteChannelMutation = useMutation({
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
        const err = await res.json();
        throw new Error(err.error || 'Failed to remove channel');
      }
      const body = await res.json();
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-channels'] });
      showNotification('success', 'Delivery channel removed successfully.');
    },
    onError: (err: Error) => {
      showNotification('error', err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: Record<string, string> = {};

    if (selectedType === 'email') {
      config.email = emailAddress.trim();
    } else if (selectedType === 'slack') {
      config.webhook_url = slackUrl.trim();
    } else if (selectedType === 'telegram') {
      config.chat_id = telegramChatId.trim();
      config.bot_token = telegramBotToken.trim();
    } else if (selectedType === 'webhook') {
      config.webhook_url = genericWebhookUrl.trim();
    }

    createChannelMutation.mutate({
      type: selectedType,
      config,
    });
  };

  if (channelsLoading) {
    return (
      <div style={{ color: 'hsl(var(--text-secondary))' }}>
        Loading notification delivery channels...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Delivery Channels</h1>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>
          Configure secure outbound notification channels to receive compiled digests and real-time
          alerts.
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '32px',
        }}
      >
        {/* Left Form: Add Channel */}
        <section className="glass-panel" style={{ padding: '30px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>Connect Notification Channel</h3>
          <form
            onSubmit={handleSubmit}
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
                Channel Protocol Type
              </label>
              <select
                value={selectedType}
                onChange={(e) =>
                  setSelectedType(e.target.value as 'email' | 'slack' | 'telegram' | 'webhook')
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border-color))',
                  background: 'hsl(var(--bg-secondary))',
                  fontSize: '0.9rem',
                  color: 'inherit',
                }}
              >
                <option value="email">Email Address</option>
                <option value="slack">Slack Incoming Webhook</option>
                <option value="telegram">Telegram Direct Chat</option>
                <option value="webhook">Custom HMAC Webhook</option>
              </select>
            </div>

            {selectedType === 'email' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    color: 'hsl(var(--text-secondary))',
                    marginBottom: '6px',
                  }}
                >
                  Destination Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. digest@example.com"
                  required
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
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
            )}

            {selectedType === 'slack' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    color: 'hsl(var(--text-secondary))',
                    marginBottom: '6px',
                  }}
                >
                  Slack Webhook URL
                </label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  required
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
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
            )}

            {selectedType === 'telegram' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: 'hsl(var(--text-secondary))',
                      marginBottom: '6px',
                    }}
                  >
                    Telegram Chat ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 987654321"
                    required
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
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
                    Bot Authorization Token
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. 123456:ABC-DEF"
                    required
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
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
              </div>
            )}

            {selectedType === 'webhook' && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    color: 'hsl(var(--text-secondary))',
                    marginBottom: '6px',
                  }}
                >
                  Destination Webhook URL
                </label>
                <input
                  type="url"
                  placeholder="https://yourserver.com/api/ingest"
                  required
                  value={genericWebhookUrl}
                  onChange={(e) => setGenericWebhookUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--border-color))',
                    background: 'hsl(var(--bg-secondary))',
                    fontSize: '0.9rem',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'hsl(var(--text-secondary))',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  Generic webhooks are validated against SSRF target ranges and auto-generate an
                  HMAC-SHA256 signing secret key.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={createChannelMutation.isPending}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent-gradient)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem',
                marginTop: '12px',
              }}
            >
              {createChannelMutation.isPending ? 'Connecting...' : 'Add delivery channel'}
            </button>
          </form>
        </section>

        {/* Right List: Connected Channels */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.3rem' }}>Active Integration Targets</h3>

          {!channels || channels.length === 0 ? (
            <div
              className="glass-panel"
              style={{
                padding: '40px',
                textAlign: 'center',
                color: 'hsl(var(--text-secondary))',
                fontStyle: 'italic',
              }}
            >
              No notification targets connected yet. Select one on the left to set up delivery.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {channels.map((channel) => {
                const isLinking = linkingChannelId === channel.id;
                return (
                  <div
                    key={channel.id}
                    className="glass-panel"
                    style={{
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      borderLeft: `4px solid ${channel.status === 'active' ? 'hsl(var(--success))' : 'hsl(var(--warning) || #f59e0b)'}`,
                    }}
                  >
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
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            textTransform: 'capitalize',
                            marginBottom: '4px',
                          }}
                        >
                          {channel.type === 'slack'
                            ? 'Slack Webhook'
                            : channel.type === 'telegram'
                              ? 'Telegram Bot'
                              : channel.type}
                        </h4>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            color: 'hsl(var(--text-secondary))',
                            wordBreak: 'break-all',
                          }}
                        >
                          {channel.type === 'email' && <span>Email: {channel.config.email}</span>}
                          {channel.type === 'slack' && (
                            <span>Webhook: {channel.config.webhook_url}</span>
                          )}
                          {channel.type === 'telegram' && (
                            <span>
                              Chat ID: {channel.config.chat_id} (Token: {channel.config.bot_token})
                            </span>
                          )}
                          {channel.type === 'webhook' && (
                            <div>
                              <span>Target: {channel.config.webhook_url}</span>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontStyle: 'italic',
                                  marginTop: '4px',
                                  color: 'hsl(142, 60%, 70%)',
                                }}
                              >
                                Signing Secret: {channel.config.signing_secret}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.7rem',
                            background:
                              channel.status === 'active'
                                ? 'rgba(16,185,129,0.12)'
                                : 'rgba(245,158,11,0.12)',
                            color:
                              channel.status === 'active'
                                ? 'hsl(var(--success))'
                                : 'hsl(38, 90%, 70%)',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                          }}
                        >
                          {channel.status}
                        </span>

                        {channel.status === 'pending' && (
                          <button
                            onClick={() => verifyChannelMutation.mutate(channel.id)}
                            disabled={verifyChannelMutation.isPending}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              border: 'none',
                              background: 'rgba(99,102,241,0.2)',
                              color: 'hsl(var(--accent-primary))',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                            }}
                          >
                            Verify Link
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Flow linkage drawer */}
                    <div
                      style={{
                        borderTop: '1px solid hsl(var(--border-color))',
                        paddingTop: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <button
                        onClick={() => setLinkingChannelId(isLinking ? null : channel.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'hsl(var(--accent-primary))',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {isLinking ? 'Close Flow Map' : 'Manage Flow linkages...'}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Remove this notification endpoint?`)) {
                            deleteChannelMutation.mutate(channel.id);
                          }
                        }}
                        disabled={deleteChannelMutation.isPending}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'hsl(var(--danger))',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    {isLinking && (
                      <FlowLinkageDrawer
                        channelId={channel.id}
                        flows={flows || []}
                        supabaseUrl={supabaseUrl}
                        session={session}
                        showNotification={showNotification}
                      />
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

// Inner Component to handle loading linkage states per channel
function FlowLinkageDrawer({
  channelId,
  flows,
  supabaseUrl,
  session,
  showNotification,
}: {
  channelId: string;
  flows: ProcessingFlow[];
  supabaseUrl: string;
  session: Session | null;
  showNotification: (type: 'success' | 'error', message: string) => void;
}) {
  const queryClient = useQueryClient();

  // Load linked mappings for each flow
  const { data: linkedFlowIds, isLoading } = useQuery<string[]>({
    queryKey: ['channel-mappings', channelId],
    queryFn: async () => {
      const token = session?.access_token;
      // We check link mappings for each flow by getting links from flow endpoint
      const mappings: string[] = [];
      for (const flow of flows) {
        const res = await fetch(`${supabaseUrl}/functions/v1/api/flows/${flow.id}/channels`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
        });
        if (res.ok) {
          const body = await res.json();
          const linkedChans: Array<{ id: string }> = body.data || [];
          if (linkedChans.some((c) => c.id === channelId)) {
            mappings.push(flow.id);
          }
        }
      }
      return mappings;
    },
  });

  const toggleLinkMutation = useMutation({
    mutationFn: async (payload: { flowId: string; isLinked: boolean }) => {
      const token = session?.access_token;
      const url = `${supabaseUrl}/functions/v1/api/flows/${payload.flowId}/channels`;

      if (payload.isLinked) {
        // Unlink
        const res = await fetch(`${url}/${channelId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
        });
        if (!res.ok) throw new Error('Failed to disconnect flow.');
      } else {
        // Link
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ channel_id: channelId }),
        });
        if (!res.ok) throw new Error('Failed to connect flow.');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-mappings', channelId] });
      showNotification('success', 'Flow links updated successfully.');
    },
    onError: (err: Error) => {
      showNotification('error', err.message);
    },
  });

  if (isLoading) {
    return (
      <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '8px' }}>
        Loading active channels mapping...
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '6px',
        padding: '12px',
        marginTop: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'hsl(var(--text-secondary))' }}>
        Toggle Briefing associations:
      </div>
      {flows.length === 0 ? (
        <span
          style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'hsl(var(--text-secondary))' }}
        >
          No briefing flows configured.
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {flows.map((flow) => {
            const isLinked = linkedFlowIds ? linkedFlowIds.includes(flow.id) : false;
            return (
              <label
                key={flow.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isLinked}
                  disabled={toggleLinkMutation.isPending}
                  onChange={() => toggleLinkMutation.mutate({ flowId: flow.id, isLinked })}
                  style={{ cursor: 'pointer' }}
                />
                <span>{flow.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
