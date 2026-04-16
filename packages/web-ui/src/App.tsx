import { useState, useEffect } from 'react';
import Dashboard   from './pages/Dashboard';
import Register    from './pages/Register';
import Discover    from './pages/Discover';
import Projects    from './pages/Projects';
import Connect     from './pages/Connect';
import Chat        from './pages/Chat';
import Audit       from './pages/Audit';
import Approvals   from './pages/Approvals';
import { loadIdentity, type AgentIdentity } from './api/aap';

export type Page = 'dashboard' | 'register' | 'discover' | 'projects' | 'connect' | 'chat' | 'audit' | 'approvals';

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard', label: 'Overview',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zM3 9a1 1 0 000 2h8a1 1 0 100-2H3zM3 14a1 1 0 000 2h5a1 1 0 100-2H3z"/></svg>,
  },
  {
    id: 'register', label: 'My Agent',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd"/></svg>,
  },
  {
    id: 'discover', label: 'Discover',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd"/></svg>,
  },
  {
    id: 'projects', label: 'Projects',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>,
  },
  {
    id: 'connect', label: 'Connect',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>,
  },
  {
    id: 'chat', label: 'Messages',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/></svg>,
  },
  {
    id: 'audit', label: 'Audit Trail',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>,
  },
  {
    id: 'approvals', label: 'Approvals',
    icon: <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>,
  },
];

export default function App() {
  const [page,     setPage]     = useState<Page>('dashboard');
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setIdentity(loadIdentity());
  }, [page]);

  // Listen for identity changes
  useEffect(() => {
    const onStorage = () => setIdentity(loadIdentity());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const agentInitials = identity?.aap_address
    ? identity.aap_address.replace('aap://', '').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">AAP Protocol</div>
            <div className="sidebar-brand-sub">v1.0 · Dashboard</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <div
              key={n.id}
              className={`nav-item${page === n.id ? ' active' : ''}`}
              onClick={() => setPage(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
              {n.id === 'approvals' && pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Agent status at bottom */}
        <div className="sidebar-footer">
          {identity ? (
            <div className="agent-status">
              <div className="agent-avatar">{agentInitials}</div>
              <div className="agent-info">
                <div className="agent-name">{identity.aap_address.replace('aap://', '')}</div>
                <div className="agent-did">{identity.did.slice(0, 26)}…</div>
              </div>
              <div className="status-dot online" title="Active" />
            </div>
          ) : (
            <div className="agent-status" style={{ cursor: 'pointer' }} onClick={() => setPage('register')}>
              <div className="agent-avatar" style={{ opacity: 0.5 }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
              </div>
              <div className="agent-info">
                <div className="agent-name" style={{ color: 'var(--text-2)' }}>No agent</div>
                <div className="agent-did" style={{ color: 'var(--accent)', opacity: 0.8 }}>Click to register →</div>
              </div>
              <div className="status-dot offline" />
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        {page === 'dashboard'  && <Dashboard  onNavigate={setPage} onPendingCount={setPendingCount} />}
        {page === 'register'   && <Register   onIdentityChange={() => setIdentity(loadIdentity())} />}
        {page === 'discover'   && <Discover   />}
        {page === 'projects'   && <Projects   />}
        {page === 'connect'    && <Connect    onChat={() => setPage('chat')} />}
        {page === 'chat'       && <Chat       />}
        {page === 'audit'      && <Audit      />}
        {page === 'approvals'  && <Approvals  />}
      </main>
    </div>
  );
}
