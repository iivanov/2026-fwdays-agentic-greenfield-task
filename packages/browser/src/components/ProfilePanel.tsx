import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  email: string;
  interests: string[];
  language_preferences: string[];
}

const LANGUAGES_LIST = [
  { code: 'en', name: 'English 🇺🇸' },
  { code: 'uk', name: 'Ukrainian 🇺🇦' },
  { code: 'de', name: 'German 🇩🇪' },
  { code: 'fr', name: 'French 🇫🇷' },
  { code: 'es', name: 'Spanish 🇪🇸' },
];

export default function ProfilePanel({ session }: { session: Session | null }) {
  const queryClient = useQueryClient();
  const [newInterest, setNewInterest] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch API URL from local env configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const apiEndpoint = `${supabaseUrl}/functions/v1/api/profiles`;

  // 1. Fetch Profile query
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<Profile>({
    queryKey: ['profile'],
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
        throw new Error(errPayload.error || 'Failed to fetch profile settings.');
      }

      const body = await res.json();
      return body.data;
    },
  });

  // Sync state when data is loaded
  useEffect(() => {
    if (profile) {
      setInterests(profile.interests);
      setLanguages(profile.language_preferences);
    }
  }, [profile]);

  // 2. Update Profile mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedData: { interests: string[]; language_preferences: string[] }) => {
      const token = session?.access_token;
      const res = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || 'Failed to save profile settings.');
      }

      const body = await res.json();
      return body.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
      showNotification('success', 'Profile settings saved successfully!');
    },
    onError: (err: Error) => {
      showNotification('error', err.message || 'Failed to save settings.');
    },
  });

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAddInterest = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newInterest.trim();
    if (clean && !interests.includes(clean)) {
      setInterests([...interests, clean]);
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (item: string) => {
    setInterests(interests.filter((i) => i !== item));
  };

  const handleLanguageToggle = (langCode: string) => {
    if (languages.includes(langCode)) {
      setLanguages(languages.filter((l) => l !== langCode));
    } else {
      setLanguages([...languages, langCode]);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      interests,
      language_preferences: languages,
    });
  };

  if (isLoading) {
    return <div style={{ color: 'hsl(var(--text-secondary))' }}>Loading your profile data...</div>;
  }

  if (error) {
    return (
      <div
        style={{
          color: 'hsl(var(--danger))',
          padding: '16px',
          border: '1px dashed hsl(var(--danger))',
          borderRadius: '8px',
        }}
      >
        Error loading profile: {(error as Error).message}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Title */}
      <div>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>User Profile</h1>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>
          Tell the AI what topics you care about and which languages to filter/translate.
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{notification.message}</span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: '32px',
        }}
      >
        {/* Interests Selection */}
        <section
          className="glass-panel"
          style={{
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Topics of Interest</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
              Add keywords or tags the AI should prioritize during digest summarization.
            </p>
          </div>

          <form onSubmit={handleAddInterest} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="e.g. Machine Learning, Space..."
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border-color))',
                background: 'hsl(var(--bg-secondary))',
                fontSize: '0.9rem',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent-gradient)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Add
            </button>
          </form>

          {/* Interests Pill Container */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              minHeight: '40px',
              alignContent: 'flex-start',
            }}
          >
            {interests.length === 0 ? (
              <span
                style={{
                  fontSize: '0.85rem',
                  color: 'hsl(var(--text-secondary))',
                  fontStyle: 'italic',
                }}
              >
                No interests added yet. Type one above!
              </span>
            ) : (
              interests.map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid hsl(var(--border-color))',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                  }}
                >
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInterest(item)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'hsl(var(--text-secondary))',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      lineHeight: 1,
                      padding: '0 2px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--danger))')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = 'hsl(var(--text-secondary))')
                    }
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Languages Selection */}
        <section
          className="glass-panel"
          style={{
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Language Preferences</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
              Select target languages. The AI will translate summaries to these languages.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {LANGUAGES_LIST.map((lang) => {
              const isSelected = languages.includes(lang.code);
              return (
                <div
                  key={lang.code}
                  onClick={() => handleLanguageToggle(lang.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 18px',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? 'hsl(var(--accent-primary))' : 'hsl(var(--border-color))'}`,
                    background: isSelected
                      ? 'rgba(99, 102, 241, 0.08)'
                      : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'hsl(var(--border-hover))';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'hsl(var(--border-color))';
                  }}
                >
                  <span style={{ fontSize: '0.95rem', fontWeight: isSelected ? 600 : 400 }}>
                    {lang.name}
                  </span>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '6px',
                      border: `2px solid ${isSelected ? 'hsl(var(--accent-primary))' : 'hsl(var(--border-color))'}`,
                      background: isSelected ? 'hsl(var(--accent-primary))' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          style={{
            padding: '14px 32px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--accent-gradient)',
            color: '#ffffff',
            fontWeight: '600',
            cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            boxShadow: '0 10px 20px rgba(99, 102, 241, 0.25)',
            transition: 'all 0.2s',
            opacity: updateMutation.isPending ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!updateMutation.isPending) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 15px 30px rgba(99, 102, 241, 0.35)';
            }
          }}
          onMouseLeave={(e) => {
            if (!updateMutation.isPending) {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 10px 20px rgba(99, 102, 241, 0.25)';
            }
          }}
        >
          {updateMutation.isPending ? 'Saving changes...' : 'Save Profile Settings'}
        </button>
      </div>
    </div>
  );
}
