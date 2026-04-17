import { useState, useEffect, createContext, useContext } from 'react';
import Landing  from './pages/Landing';
import Signup   from './pages/Signup';
import SignIn   from './pages/SignIn';
import Verify   from './pages/Verify';
import Onboard  from './pages/Onboard';
import Home     from './pages/Home';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SynapseUser {
  id?:    string;
  name:   string;
  email:  string;
  handle: string;
  did:    string;
  aap_address:     string;
  public_key_hex:  string;
  private_key_hex: string;
  registered_at:   string;
  auth_token?:     string;   // JWT from backend
  avatar_url?:     string;
}

export type Page = 'landing' | 'signup' | 'signin' | 'verify' | 'onboard' | 'home';

// ─── Context ─────────────────────────────────────────────────────────────────

interface AppCtx {
  user:    SynapseUser | null;
  setUser: (u: SynapseUser | null) => void;
  page:    Page;
  go:      (p: Page) => void;
  draft:   { name: string; email: string; handle: string };
  setDraft: (d: { name: string; email: string; handle: string }) => void;
}

const Ctx = createContext<AppCtx>({} as AppCtx);
export const useApp = () => useContext(Ctx);

const USER_KEY  = 'synapse:user';
const DRAFT_KEY = 'synapse:draft';
const REGISTRY  = import.meta.env.VITE_REGISTRY_URL || '';

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [user,  setUserState]  = useState<SynapseUser | null>(() => {
    try { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  });
  const [page,  setPage]       = useState<Page>('loading' as Page);
  const [draft, setDraftState] = useState({ name: '', email: '', handle: '' });

  function setUser(u: SynapseUser | null) {
    setUserState(u);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else   localStorage.removeItem(USER_KEY);
  }

  function go(p: Page) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setPage(p);
  }

  function setDraft(d: { name: string; email: string; handle: string }) {
    setDraftState(d);
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  }

  // ── On mount: handle OAuth callback & session restore ──────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // ── OAuth success: ?auth_token=JWT&is_new=true ──────────────────────────
    const authToken = params.get('auth_token');
    if (authToken) {
      // Clean URL immediately
      window.history.replaceState({}, '', window.location.pathname);
      handleOAuthCallback(authToken, params.get('is_new') === 'true');
      return;
    }

    // ── OAuth error ──────────────────────────────────────────────────────────
    const authError = params.get('auth_error');
    if (authError) {
      window.history.replaceState({}, '', window.location.pathname);
      console.warn('[Auth] OAuth error:', authError);
      // Show signup page with error context
      setPage('signup');
      return;
    }

    // ── Email sign-in return (from SignIn page) ──────────────────────────────
    const authReturn = params.get('auth_return');
    if (authReturn) {
      window.history.replaceState({}, '', window.location.pathname);
      const token    = sessionStorage.getItem('synapse:auth_token');
      const userJson = sessionStorage.getItem('synapse:auth_user');
      const isNew    = sessionStorage.getItem('synapse:is_new') === 'true';
      sessionStorage.removeItem('synapse:auth_token');
      sessionStorage.removeItem('synapse:auth_user');
      sessionStorage.removeItem('synapse:is_new');
      if (token && userJson) {
        const u = JSON.parse(userJson);
        mapAndSetUser(u, token, isNew);
        return;
      }
    }

    // ── Restore draft ────────────────────────────────────────────────────────
    try {
      const r = sessionStorage.getItem(DRAFT_KEY);
      if (r) setDraftState(JSON.parse(r));
    } catch { /* noop */ }

    // ── Decide initial page ──────────────────────────────────────────────────
    try {
      const stored = localStorage.getItem(USER_KEY);
      setPage(stored ? 'home' : 'landing');
    } catch { setPage('landing'); }
  }, []);

  // ── Handle OAuth token: decode payload, set user, navigate ────────────────
  async function handleOAuthCallback(token: string, isNew: boolean) {
    try {
      // Decode JWT payload (we trust the backend signed it)
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

      if (!payload.handle && isNew) {
        // New OAuth user — needs to complete onboarding
        // Store token so Onboard can link the agent
        sessionStorage.setItem('synapse:oauth_token', token);
        setDraft({ name: payload.name || '', email: payload.email, handle: '' });
        setPage('onboard');
        return;
      }

      // Existing user with agent — fetch full profile from backend
      if (REGISTRY && payload.sub) {
        try {
          const r = await fetch(`${REGISTRY}/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r.ok) {
            const { user: u } = await r.json();
            mapAndSetUser(u, token, false);
            return;
          }
        } catch { /* fall through to payload */ }
      }

      mapAndSetUser({
        id: payload.sub, email: payload.email,
        name: payload.name, handle: payload.handle,
        did: payload.did, aap_address: `aap://${payload.handle}`,
      }, token, isNew);
    } catch (e) {
      console.error('[Auth] Failed to process OAuth token', e);
      setPage('signin');
    }
  }

  function mapAndSetUser(raw: Record<string, string>, token: string, isNew: boolean) {
    const u: SynapseUser = {
      id:              raw.id       ?? '',
      name:            raw.name     ?? raw.email?.split('@')[0] ?? '',
      email:           raw.email    ?? '',
      handle:          raw.handle   ?? '',
      did:             raw.did      ?? `did:aap:${raw.id ?? ''}`,
      aap_address:     raw.aap_address ?? `aap://${raw.handle ?? ''}`,
      public_key_hex:  raw.public_key_hex  ?? '',
      private_key_hex: '',  // never stored on backend
      registered_at:   raw.registered_at ?? new Date().toISOString(),
      auth_token:      token,
      avatar_url:      raw.avatar_url ?? '',
    };
    setUser(u);
    setPage(isNew || !u.handle ? 'onboard' : 'home');
  }

  // Loading state (resolving initial page)
  if (page === ('loading' as Page)) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 24, height: 24, borderWidth: 2.5 }} />
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ user, setUser, page, go, draft, setDraft }}>
      {page === 'landing' && <Landing />}
      {page === 'signup'  && <Signup  />}
      {page === 'signin'  && <SignIn  />}
      {page === 'verify'  && <Verify  />}
      {page === 'onboard' && <Onboard />}
      {page === 'home'    && <Home    />}
    </Ctx.Provider>
  );
}
