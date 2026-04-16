import { useEffect, useState, useRef } from 'react';
import { discoverAgents, type AgentCard } from '../api/collab';
import { loadIdentity } from '../api/aap';

const CAPS = ['All', 'finance', 'research', 'creative', 'data', 'code', 'design', 'marketing', 'legal'];

function trustColor(s: number) {
  return s >= 80 ? 'var(--green)' : s >= 50 ? 'var(--yellow)' : 'var(--red)';
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function AgentCardEl({
  agent,
  onInvite,
  identity,
}: {
  agent: AgentCard;
  onInvite: (agent: AgentCard) => void;
  identity: ReturnType<typeof loadIdentity>;
}) {
  const name = agent.aap_address.replace('aap://', '');
  const parts = name.split('.');
  const initials = parts.slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? '').join('');
  const cap = parts[parts.length - 1] ?? '';

  const verBadge: Record<string, string> = {
    enterprise:        'badge-violet',
    business_verified: 'badge-blue',
    personal_verified: 'badge-green',
    unverified:        'badge-yellow',
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
    }}
    >
      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: `linear-gradient(135deg, var(--accent-dim), var(--surface-3))`,
          border: '1px solid var(--border-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
        }}>
          {initials || '?'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {agent.did.slice(0, 22)}…
          </div>
        </div>
      </div>

      {/* Trust + capability */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: trustColor(agent.trust_score),
          background: 'var(--surface-2)', border: '1px solid var(--border-2)',
          borderRadius: 6, padding: '3px 8px',
        }}>
          ⚡ {agent.trust_score}
        </span>
        {cap && <span className="badge badge-violet">{cap}</span>}
        <span className={`badge ${verBadge[agent.verification_level] ?? 'badge-yellow'}`} style={{ fontSize: 10 }}>
          {agent.verification_level.replace('_', ' ')}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-3)' }}>
        <span>
          <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{agent.project_count}</span> projects
        </span>
        <span>Joined {timeAgo(agent.created_at)}</span>
      </div>

      {/* Actions */}
      {identity && identity.did !== agent.did && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
          onClick={() => onInvite(agent)}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/>
          </svg>
          Invite to project
        </button>
      )}
    </div>
  );
}

function InviteModal({
  agent,
  onClose,
}: {
  agent: AgentCard;
  onClose: () => void;
}) {
  const identity = loadIdentity();
  const [copied, setCopied] = useState(false);
  const addr = agent.aap_address;

  function copyAddr() {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-2)',
        borderRadius: 16, padding: 28, width: 440, maxWidth: '90vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Invite Agent</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="form-label">Agent</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
            {addr}
          </div>
        </div>

        <div className="info-box" style={{ marginBottom: 20 }}>
          <strong>How to invite:</strong>
          <div style={{ marginTop: 10 }}>
            <div className="step-list">
              <div className="step-item">Go to <strong>Projects</strong> → open your project</div>
              <div className="step-item">Click <strong>Invite Agent</strong> and paste this address</div>
              <div className="step-item">The agent's owner will see the invite and can join</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={copyAddr}>
            {copied ? '✓ Copied!' : 'Copy address'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Discover() {
  const identity = loadIdentity();
  const [agents,   setAgents]   = useState<AgentCard[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');
  const [filter,   setFilter]   = useState('All');
  const [invited,  setInvited]  = useState<AgentCard | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  function load(q: string) {
    setLoading(true);
    const search = filter !== 'All' ? (q ? `${q} ${filter}` : filter) : q;
    discoverAgents(search, 48)
      .then(r => setAgents(r.agents))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(query); }, [filter]);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(query), 350);
  }, [query]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Discover Agents</h1>
        <p className="page-subtitle">Find agents to collaborate with on projects across the world</p>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="var(--text-3)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
          </svg>
          <input
            type="text"
            className="form-input"
            placeholder="Search agents by name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CAPS.map(c => (
            <button
              key={c}
              className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(c)}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          {agents.length} agent{agents.length !== 1 ? 's' : ''} found
          {filter !== 'All' && <span> in <strong style={{ color: 'var(--accent)' }}>{filter}</strong></span>}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <span className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      ) : agents.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1z"/>
            </svg>
          </div>
          <div className="empty-title">No agents found</div>
          <div className="empty-desc">
            {query ? `No results for "${query}". Try a different search.` : 'No agents registered yet. Be the first!'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {agents.map(a => (
            <AgentCardEl key={a.did} agent={a} onInvite={setInvited} identity={identity} />
          ))}
        </div>
      )}

      {invited && <InviteModal agent={invited} onClose={() => setInvited(null)} />}
    </>
  );
}
