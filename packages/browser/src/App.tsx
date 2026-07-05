import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import ProfilePanel from './components/ProfilePanel.js';
import SourcesPanel from './components/SourcesPanel.js';
import FlowsPanel from './components/FlowsPanel.js';
import DeliveryPanel from './components/DeliveryPanel.js';
import DigestFeedbackPanel from './components/DigestFeedbackPanel.js';
import { type Session } from '@supabase/supabase-js';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<
    'profile' | 'sources' | 'flows' | 'delivery' | 'digests'
  >('profile');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      setLoginError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Failed to initiate OAuth login.');
    }
  };

  const handleLocalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoginError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Failed to sign in.');
    }
  };

  const handleLocalSignUp = async () => {
    try {
      setLoginError(null);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      alert('Sign up successful! Please log in.');
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Failed to sign up.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="spinner">Loading session...</div>
      </div>
    );
  }

  // Login Screen (Mockup + Local developer login capabilities)
  if (!session) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background:
            'radial-gradient(circle at 10% 20%, hsl(224 25% 15%) 0%, hsl(224 25% 10%) 90%)',
        }}
      >
        <div
          className="glass-panel"
          style={{
            maxWidth: '440px',
            width: '100%',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontSize: '2rem',
                marginBottom: '8px',
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              News Aggregator
            </h1>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
              Configure your daily AI-driven newsletter digest.
            </p>
          </div>

          {loginError && (
            <div
              style={{
                background: 'rgba(220, 38, 38, 0.15)',
                border: '1px dashed hsl(var(--danger))',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: 'hsl(var(--danger))',
              }}
            >
              {loginError}
            </div>
          )}

          {/* Social Logins */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => handleOAuthLogin('google')}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border-color))',
                background: 'rgba(255,255,255,0.03)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              Sign in with Google
            </button>
            <button
              onClick={() => handleOAuthLogin('github')}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid hsl(var(--border-color))',
                background: 'rgba(255,255,255,0.03)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              Sign in with GitHub
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
              or dev login
            </span>
            <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Local login form */}
          <form
            onSubmit={handleLocalSignIn}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div>
              <label
                style={{
                  fontSize: '0.8rem',
                  color: 'hsl(var(--text-secondary))',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border-color))',
                  background: 'hsl(var(--bg-secondary))',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '0.8rem',
                  color: 'hsl(var(--text-secondary))',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border-color))',
                  background: 'hsl(var(--bg-secondary))',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent-gradient)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={handleLocalSignUp}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border-color))',
                  background: 'transparent',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign Up
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // Authenticated Dashboard
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Premium Header */}
      <header
        className="glass-panel"
        style={{
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <h2
            style={{
              fontSize: '1.4rem',
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            News Personalization
          </h2>
          <nav style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('profile')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'profile' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color:
                  activeTab === 'profile'
                    ? 'hsl(var(--text-primary))'
                    : 'hsl(var(--text-secondary))',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Preferences
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'sources' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color:
                  activeTab === 'sources'
                    ? 'hsl(var(--text-primary))'
                    : 'hsl(var(--text-secondary))',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Sources
            </button>
            <button
              onClick={() => setActiveTab('flows')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'flows' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color:
                  activeTab === 'flows' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Flows
            </button>
            <button
              onClick={() => setActiveTab('delivery')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'delivery' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color:
                  activeTab === 'delivery'
                    ? 'hsl(var(--text-primary))'
                    : 'hsl(var(--text-secondary))',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Delivery
            </button>
            <button
              onClick={() => setActiveTab('digests')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'digests' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color:
                  activeTab === 'digests'
                    ? 'hsl(var(--text-primary))'
                    : 'hsl(var(--text-secondary))',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Digests
            </button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
            {session.user.email}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid hsl(var(--border-color))',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.85rem',
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
            Log Out
          </button>
        </div>
      </header>

      {/* Main Panel grid */}
      <main
        style={{ flex: 1, padding: '40px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}
      >
        {activeTab === 'profile' ? (
          <ProfilePanel session={session} />
        ) : activeTab === 'sources' ? (
          <SourcesPanel session={session} />
        ) : activeTab === 'flows' ? (
          <FlowsPanel session={session} />
        ) : activeTab === 'delivery' ? (
          <DeliveryPanel session={session} />
        ) : (
          <DigestFeedbackPanel session={session} />
        )}
      </main>
    </div>
  );
}
