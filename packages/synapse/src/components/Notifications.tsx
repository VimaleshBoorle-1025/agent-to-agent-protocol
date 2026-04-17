import { useState } from 'react';
import { Notification, MOCK_NOTIFICATIONS } from '../api/client';

const TYPE_ICON: Record<string, React.ReactNode> = {
  message: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  ),
  project_invite: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  task_assigned: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  connection: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  mention: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
    </svg>
  ),
  publication: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
};

const TYPE_COLOR: Record<string, string> = {
  message:        '#60a5fa',
  project_invite: '#a78bfa',
  task_assigned:  '#fb923c',
  connection:     '#4ade80',
  mention:        '#facc15',
  publication:    '#f472b6',
};

export default function Notifications({ onClose }: { onClose: () => void }) {
  const [notifs, setNotifs] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  const unread = notifs.filter(n => !n.read).length;

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  function dismiss(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id));
  }

  function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 56, right: 16, zIndex: 901,
        width: 360, maxHeight: 'calc(100vh - 80px)',
        background: '#0d0d0d',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        overflow: 'hidden',
      }} className="anim-scale-in">
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700 }}>Notifications</span>
            {unread > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#000',
                background: '#fff', borderRadius: '999px',
                padding: '1px 7px', lineHeight: 1.6,
              }}>
                {unread}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 12, color: 'rgba(255,255,255,0.4)', background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px',
            }}>×</button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notifs.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <p style={{ fontSize: 14 }}>All caught up!</p>
            </div>
          ) : (
            notifs.map((n, idx) => {
              const color = TYPE_COLOR[n.type] ?? '#fff';
              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px',
                    background: n.read ? 'transparent' : 'rgba(255,255,255,0.025)',
                    borderBottom: idx < notifs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    cursor: 'pointer', transition: 'background 0.12s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'rgba(255,255,255,0.025)'}
                >
                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{
                      position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
                      width: 5, height: 5, borderRadius: '50%', background: '#fff',
                    }} />
                  )}

                  {/* Icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: `${color}15`,
                    border: `1px solid ${color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color,
                  }}>
                    {TYPE_ICON[n.type]}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: n.read ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.85)', lineHeight: 1.45, marginBottom: 4 }}>
                      {n.content}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{n.ts}</span>
                      {n.action_label && (
                        <span style={{
                          fontSize: 11, color, cursor: 'pointer',
                          fontWeight: 500,
                        }}>
                          {n.action_label} →
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                    style={{
                      background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)',
                      cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px',
                      flexShrink: 0, transition: 'color 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.15)'}
                  >×</button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
