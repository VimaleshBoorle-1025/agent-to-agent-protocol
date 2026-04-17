import { useState, useEffect, createContext, useContext } from 'react';
import Landing  from './pages/Landing';
import Signup   from './pages/Signup';
import Verify   from './pages/Verify';
import Onboard  from './pages/Onboard';
import Home     from './pages/Home';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SynapseUser {
  name:    string;
  email:   string;
  handle:  string;           // e.g. "alice.research"
  did:     string;           // from AAP registry
  aap_address: string;       // aap://alice.research
  public_key_hex:  string;
  private_key_hex: string;
  registered_at:   string;
}

export type Page = 'landing' | 'signup' | 'verify' | 'onboard' | 'home';

// ─── Context ─────────────────────────────────────────────────────────────────

interface AppCtx {
  user:    SynapseUser | null;
  setUser: (u: SynapseUser | null) => void;
  page:    Page;
  go:      (p: Page) => void;
  // signup draft (carried between signup → verify → onboard)
  draft:   { name: string; email: string; handle: string };
  setDraft: (d: { name: string; email: string; handle: string }) => void;
}

const Ctx = createContext<AppCtx>({} as AppCtx);
export const useApp = () => useContext(Ctx);

const USER_KEY  = 'synapse:user';
const DRAFT_KEY = 'synapse:draft';

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [user,  setUserState]  = useState<SynapseUser | null>(() => {
    try { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  });
  const [page,  setPage]       = useState<Page>(() => {
    try { const r = localStorage.getItem(USER_KEY); return r ? 'home' : 'landing'; } catch { return 'landing'; }
  });
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

  // Restore draft from session
  useEffect(() => {
    try {
      const r = sessionStorage.getItem(DRAFT_KEY);
      if (r) setDraftState(JSON.parse(r));
    } catch { /* noop */ }
  }, []);

  return (
    <Ctx.Provider value={{ user, setUser, page, go, draft, setDraft }}>
      {page === 'landing' && <Landing />}
      {page === 'signup'  && <Signup  />}
      {page === 'verify'  && <Verify  />}
      {page === 'onboard' && <Onboard />}
      {page === 'home'    && <Home    />}
    </Ctx.Provider>
  );
}
