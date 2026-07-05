import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import ProfilePanel from './components/ProfilePanel.js';
import SourcesPanel from './components/SourcesPanel.js';
import FlowsPanel from './components/FlowsPanel.js';
import DeliveryPanel from './components/DeliveryPanel.js';
import DigestFeedbackPanel from './components/DigestFeedbackPanel.js';
import DashboardOverview, { dashboardFixture } from './components/DashboardOverview.js';
import { type Session } from '@supabase/supabase-js';

type DashboardTab = 'overview' | 'profile' | 'sources' | 'flows' | 'delivery' | 'digests';

const e2eFixtureMode =
  import.meta.env.MODE === 'e2e' &&
  import.meta.env.VITE_E2E_DASHBOARD_FIXTURE === '1' &&
  new URLSearchParams(window.location.search).get('fixture') === 'dashboard';

const fixtureSession = {
  access_token: 'fixture-access-token',
  refresh_token: 'fixture-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'fixture-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'editor@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-07-05T00:00:00.000Z',
  },
} as Session;

const dashboardTabs: Array<{ id: DashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Preferences' },
  { id: 'sources', label: 'Sources' },
  { id: 'flows', label: 'Flows' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'digests', label: 'Digests' },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (e2eFixtureMode) {
      setSession(fixtureSession);
      setLoading(false);
      return;
    }

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
    <div className="app-shell">
      <header className="app-masthead">
        <div className="masthead-brand">
          <p className="eyebrow">AI news desk</p>
          <h2>News Personalization</h2>
        </div>
        <nav className="tab-nav" aria-label="Dashboard sections">
          {dashboardTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`tab-button${activeTab === tab.id ? ' tab-button--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="account-strip">
          <span>{session.user.email}</span>
          <button className="secondary-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="app-content">
        {activeTab === 'overview' ? (
          <DashboardOverview
            session={session}
            fixture={e2eFixtureMode ? dashboardFixture : undefined}
            onOpenTab={setActiveTab}
          />
        ) : activeTab === 'profile' ? (
          <ProfilePanel session={session} />
        ) : activeTab === 'sources' ? (
          <SourcesPanel session={session} />
        ) : activeTab === 'flows' ? (
          <FlowsPanel session={session} />
        ) : activeTab === 'delivery' ? (
          <DeliveryPanel session={session} />
        ) : (
          <DigestFeedbackPanel
            session={session}
            fixtureReport={e2eFixtureMode ? dashboardFixture.digestReport : undefined}
          />
        )}
      </main>
    </div>
  );
}
