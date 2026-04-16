import { useState } from 'react';
import Dashboard   from './pages/Dashboard';
import Register    from './pages/Register';
import Connect     from './pages/Connect';
import Chat        from './pages/Chat';
import Audit       from './pages/Audit';
import Approvals   from './pages/Approvals';

type Page = 'dashboard' | 'register' | 'connect' | 'chat' | 'audit' | 'approvals';

const NAV: { id: Page; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard'  },
  { id: 'register',  icon: '🔑', label: 'My Agent'   },
  { id: 'connect',   icon: '🔗', label: 'Connect'    },
  { id: 'chat',      icon: '💬', label: 'Chat'       },
  { id: 'audit',     icon: '📋', label: 'Audit Trail'},
  { id: 'approvals', icon: '🔔', label: 'Approvals'  },
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">AAP <span>Dashboard</span></div>
        {NAV.map(n => (
          <div
            key={n.id}
            className={`nav-item${page === n.id ? ' active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </div>
        ))}
      </aside>
      <main className="main">
        {page === 'dashboard'  && <Dashboard  onNavigate={setPage} />}
        {page === 'register'   && <Register   />}
        {page === 'connect'    && <Connect    onChat={() => setPage('chat')} />}
        {page === 'chat'       && <Chat       />}
        {page === 'audit'      && <Audit      />}
        {page === 'approvals'  && <Approvals  />}
      </main>
    </div>
  );
}
