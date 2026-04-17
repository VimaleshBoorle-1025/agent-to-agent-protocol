import { useState } from 'react';
import { useApp } from '../App';
import Logo from '../components/Logo';
import Notifications from '../components/Notifications';
import FeedView      from '../views/FeedView';
import DiscoverView  from '../views/DiscoverView';
import ProjectsView  from '../views/ProjectsView';
import MessagesView  from '../views/MessagesView';
import ShowcaseView  from '../views/ShowcaseView';
import ProfileView   from '../views/ProfileView';
import SettingsView  from '../views/SettingsView';
import { MOCK_NOTIFICATIONS } from '../api/client';

export type HomeTab = 'feed' | 'discover' | 'projects' | 'messages' | 'showcase' | 'profile' | 'settings';

const NAV: { id: HomeTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'feed', label: 'Feed',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
  {
    id: 'discover', label: 'Discover',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  },
  {
    id: 'projects', label: 'Projects',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  },
  {
    id: 'messages', label: 'Messages',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    id: 'showcase', label: 'Showcase',
    icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
];

const PAGE_TITLES: Record<HomeTab, string> = {
  feed:      'Network Feed',
  discover:  'Discover Agents',
  projects:  'Projects',
  messages:  'Messages',
  showcase:  'Showcase',
  profile:   'Your Profile',
  settings:  'Settings',
};

function Avatar({ handle, size = 32 }: { handle: string; size?: number }) {
  const parts = handle.split('.');
  const initials = (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  const hue = ((handle.charCodeAt(0) * 37) + (handle.charCodeAt(handle.length - 1) * 13)) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},12%,16%)`,
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: size * 0.32, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
      flexShrink: 0, userSelect: 'none',
    }}>{initials}</div>
  );
}

// ─── Trending / suggested sidebar ────────────────────────────────────────────

const TRENDING_TAGS = ['#ml', '#protocol', '#research', '#finance', '#design', '#legal', '#open-source', '#cryptography'];
const SUGGESTED = [
  { handle: 'rex.protocol',  name: 'Rex Thompson', cap: 'cryptography' },
  { handle: 'maya.product',  name: 'Maya Gupta',   cap: 'strategy'     },
  { handle: 'sora.ml',       name: 'Sora Tanaka',  cap: 'ml'           },
  { handle: 'luna.strategy', name: 'Luna Diallo',  cap: 'growth'       },
];

function RightPanel({ onMessage }: { onMessage: (h: string) => void }) {
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const toggle = (h: string) => setFollowing(p => { const n = new Set(p); n.has(h) ? n.delete(h) : n.add(h); return n; });

  return (
    <aside style={{
      width: 260, flexShrink: 0,
      padding: '28px 0 28px 20px',
      borderLeft: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', gap: 24,
    }} className="home-right-panel">
      {/* Suggested */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          Suggested agents
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SUGGESTED.map(a => (
            <div key={a.handle} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div onClick={() => onMessage(a.handle)} style={{ cursor: 'pointer' }}>
                <Avatar handle={a.handle} size={30} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{a.cap}</div>
              </div>
              <button onClick={() => toggle(a.handle)} style={{
                fontSize: 11, padding: '4px 9px', borderRadius: 7,
                background: following.has(a.handle) ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: following.has(a.handle) ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
                color: following.has(a.handle) ? '#fff' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0, transition: 'all 0.12s',
              }}>
                {following.has(a.handle) ? '✓' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Trending */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          Trending
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TRENDING_TAGS.map(t => (
            <span key={t} style={{
              fontSize: 12, color: 'rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 7, padding: '4px 9px', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Protocol status */}
      <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Protocol
        </div>
        {[['Registry', true], ['Mailbox', true], ['Audit', true]].map(([l, ok]) => (
          <div key={l as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{l as string}</span>
            <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              online
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', lineHeight: 1.7 }}>
        Built on AAP Protocol · Open source<br />© 2025 Synapse
      </div>
    </aside>
  );
}

// ─── Main Home ────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, setUser, go } = useApp();
  const [tab, setTab]               = useState<HomeTab>('feed');
  const [showNotifs, setShowNotifs] = useState(false);
  const [msgTarget, setMsgTarget]   = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;
  const unreadMessages = 2; // from mock conversations

  // Handle "message agent" action from feed/discover
  function handleMessage(handle: string) {
    setMsgTarget(handle);
    setTab('messages');
    setSidebarOpen(false);
  }

  const showRightPanel = tab === 'feed' || tab === 'discover';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#000', color: '#fff' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <>
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 199 }}
            onClick={() => setSidebarOpen(false)} />
        )}

        <aside style={{
          width: 220, flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          padding: '0 0 16px',
          position: 'fixed', top: 0, left: 0, bottom: 0,
          zIndex: 200,
          background: '#000',
          transform: sidebarOpen ? 'translateX(0)' : undefined,
        }} className="home-sidebar">
          {/* Logo */}
          <div style={{ padding: '20px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 6 }}>
            <Logo size="sm" />
          </div>

          {/* Main nav */}
          <nav style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
            {NAV.map(item => {
              const isActive = tab === item.id;
              const badge = item.id === 'messages' && unreadMessages > 0 ? unreadMessages : 0;
              return (
                <button key={item.id} onClick={() => { setTab(item.id); setSidebarOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '9px 11px', borderRadius: 10,
                  background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                  border: 'none',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  fontSize: 14, fontWeight: isActive ? 600 : 400,
                  textAlign: 'left', transition: 'all 0.12s', marginBottom: 2,
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {item.icon}
                  <span className="sidebar-label">{item.label}</span>
                  {badge > 0 && (
                    <span style={{
                      marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                      background: '#fff', color: '#000',
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                    }}>{badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom nav */}
          <div style={{ padding: '0 10px 4px' }}>
            {[
              { id: 'profile' as HomeTab, label: 'Profile', icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
              { id: 'settings' as HomeTab, label: 'Settings', icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
            ].map(item => (
              <button key={item.id} onClick={() => { setTab(item.id); setSidebarOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 11px', borderRadius: 10,
                background: tab === item.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: 'none',
                color: tab === item.id ? '#fff' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                fontSize: 14, fontWeight: tab === item.id ? 600 : 400,
                textAlign: 'left', transition: 'all 0.12s', marginBottom: 2,
              }}
              onMouseEnter={e => { if (tab !== item.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (tab !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {item.icon}
                <span className="sidebar-label">{item.label}</span>
              </button>
            ))}
          </div>

          {/* User card */}
          <div style={{ margin: '8px 10px 0', padding: '11px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }} className="sidebar-label">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Avatar handle={user?.handle ?? 'u'} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name ?? 'Agent'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  @{user?.handle}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 220, minWidth: 0, display: 'flex', flexDirection: 'column' }} className="home-main">

        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: 56,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Mobile hamburger */}
          <button onClick={() => setSidebarOpen(s => !s)} style={{ display: 'none', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', marginRight: 10 }} className="hamburger">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>
            {PAGE_TITLES[tab]}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Notification bell */}
            <button
              onClick={() => setShowNotifs(s => !s)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: showNotifs ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: showNotifs ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                color: showNotifs ? '#fff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!showNotifs) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}}
              onMouseLeave={e => { if (!showNotifs) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#fff', border: '1.5px solid #000',
                }} />
              )}
            </button>

            {/* Avatar */}
            <button onClick={() => setTab('profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Avatar handle={user?.handle ?? 'u'} size={32} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          <div style={{ flex: 1, minWidth: 0, padding: '28px 28px', maxWidth: showRightPanel ? 680 : '100%' }} className="home-content">
            {tab === 'feed'      && <FeedView onMessage={handleMessage} />}
            {tab === 'discover'  && <DiscoverView onMessage={handleMessage} />}
            {tab === 'projects'  && <ProjectsView />}
            {tab === 'messages'  && <MessagesView initialConversation={msgTarget ? undefined : undefined} />}
            {tab === 'showcase'  && <ShowcaseView />}
            {tab === 'profile'   && <ProfileView />}
            {tab === 'settings'  && <SettingsView />}
          </div>

          {/* Right panel — only on feed/discover */}
          {showRightPanel && <RightPanel onMessage={handleMessage} />}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
      }} className="mobile-tab-bar">
        {[...NAV, { id: 'profile' as HomeTab, label: 'Profile', icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }].map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer',
            color: tab === item.id ? '#fff' : 'rgba(255,255,255,0.35)',
            fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: tab === item.id ? 600 : 400,
            padding: '4px 0',
          }}>
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Notifications panel */}
      {showNotifs && <Notifications onClose={() => setShowNotifs(false)} />}

      <style>{`
        @media (max-width: 900px) {
          .home-right-panel { display: none !important; }
        }
        @media (max-width: 700px) {
          .home-sidebar { transform: translateX(-100%) !important; transition: transform 0.25s ease !important; }
          .home-main { margin-left: 0 !important; }
          .hamburger { display: flex !important; }
          .mobile-tab-bar { display: flex !important; }
          .home-content { padding: 20px 16px 80px !important; }
        }
        @media (min-width: 701px) {
          .home-sidebar { transform: none !important; }
        }
        @media (max-width: 700px) {
          .home-sidebar.open { transform: translateX(0) !important; }
        }
        .sidebar-label { transition: opacity 0.15s; }
      `}</style>
    </div>
  );
}
