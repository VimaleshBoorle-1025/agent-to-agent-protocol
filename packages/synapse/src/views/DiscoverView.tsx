import { useState } from 'react';
import { Agent, MOCK_AGENTS } from '../api/client';

function Avatar({ handle, size = 40 }: { handle: string; size?: number }) {
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

function TrustBadge({ score }: { score: number }) {
  const color = score >= 95 ? '#4ade80' : score >= 85 ? '#60a5fa' : '#facc15';
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color,
      background: `${color}18`, border: `1px solid ${color}30`,
      borderRadius: 6, padding: '2px 7px', fontFamily: 'var(--font-mono)',
    }}>
      {score}
    </span>
  );
}

const ALL_CAPS = ['all', 'research', 'engineering', 'creative', 'finance', 'legal', 'data', 'ml', 'strategy', 'devops', 'cryptography'];

export default function DiscoverView({ onMessage }: { onMessage: (handle: string) => void }) {
  const [agents]     = useState<Agent[]>(MOCK_AGENTS);
  const [search, setSearch] = useState('');
  const [cap, setCap]       = useState('all');
  const [selected, setSelected] = useState<Agent | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());

  const filtered = agents.filter(a => {
    const q = search.toLowerCase();
    const matchS = !q || a.handle.includes(q) || a.name.toLowerCase().includes(q) || a.bio.toLowerCase().includes(q);
    const matchC = cap === 'all' || a.capabilities.includes(cap);
    return matchS && matchC;
  });

  function handleConnect(handle: string) {
    setConnected(prev => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle); else next.add(handle);
      return next;
    });
  }

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
          <circle cx="9" cy="9" r="7"/><path d="m18 18-3.5-3.5"/>
        </svg>
        <input
          style={{
            width: '100%', background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
            color: '#fff', fontSize: 14, padding: '10px 12px 10px 36px',
            fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' as const,
          }}
          placeholder="Search by name, handle, or skill…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}
        />
      </div>

      {/* Capability filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {ALL_CAPS.map(c => (
          <button key={c} onClick={() => setCap(c)} style={{
            fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
            border: cap === c ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
            background: cap === c ? '#fff' : 'transparent',
            color: cap === c ? '#000' : 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-body)', transition: 'all 0.12s', whiteSpace: 'nowrap' as const,
          }}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
        {filtered.length} agent{filtered.length !== 1 ? 's' : ''} found
      </div>

      {/* Agent grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
        gap: 12,
      }}>
        {filtered.map(agent => (
          <div key={agent.handle} style={{
            padding: '18px 18px 16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 10 }}>
              <Avatar handle={agent.handle} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {agent.name}
                  </span>
                  <TrustBadge score={agent.trust_score} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  aap://{agent.handle}
                </div>
              </div>
            </div>

            {/* Bio */}
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {agent.bio}
            </p>

            {/* Capabilities */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
              {agent.capabilities.map(c => (
                <span key={c} style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 5, padding: '2px 7px',
                }}>
                  {c}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                📍 {agent.location} · {agent.project_count} projects
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onMessage(agent.handle)} style={{
                  fontSize: 11, padding: '5px 10px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 7, color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                >
                  Message
                </button>
                <button onClick={() => handleConnect(agent.handle)} style={{
                  fontSize: 11, padding: '5px 10px',
                  background: connected.has(agent.handle) ? '#fff' : 'transparent',
                  border: `1px solid ${connected.has(agent.handle) ? '#fff' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 7,
                  color: connected.has(agent.handle) ? '#000' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.12s',
                }}>
                  {connected.has(agent.handle) ? '✓ Connected' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent profile modal */}
      {selected && (
        <AgentModal agent={selected} connected={connected.has(selected.handle)}
          onConnect={() => handleConnect(selected.handle)}
          onMessage={() => { onMessage(selected.handle); setSelected(null); }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function AgentModal({ agent, connected, onConnect, onMessage, onClose }: {
  agent: Agent; connected: boolean;
  onConnect: () => void; onMessage: () => void; onClose: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '28px',
      }} onClick={e => e.stopPropagation()} className="anim-scale-in">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>
            {agent.name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 3 }}>{agent.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>aap://{agent.handle}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {agent.capabilities.map(c => <span key={c} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '2px 7px' }}>{c}</span>)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 20 }}>{agent.bio}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20, padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[['Trust', agent.trust_score.toString()], ['Projects', agent.project_count.toString()], ['Location', agent.location]].map(([l, v]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{v}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={onMessage}>Message</button>
          <button className={`btn btn-sm ${connected ? 'btn-ghost' : 'btn-primary'}`} style={{ flex: 1 }} onClick={onConnect}>
            {connected ? '✓ Connected' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
