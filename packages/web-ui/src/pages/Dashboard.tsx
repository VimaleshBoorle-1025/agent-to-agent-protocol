import { useEffect, useState } from 'react';
import { loadIdentity, getTrustScore, verifyChain, getPendingApprovals, type AgentIdentity, type TrustInfo } from '../api/aap';

type Page = 'dashboard' | 'register' | 'connect' | 'chat' | 'audit' | 'approvals';

export default function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [trust,    setTrust]    = useState<TrustInfo | null>(null);
  const [chain,    setChain]    = useState<{ valid: boolean; length: number } | null>(null);
  const [pending,  setPending]  = useState(0);

  useEffect(() => {
    const id = loadIdentity();
    setIdentity(id);
    if (id) {
      getTrustScore(id.did).then(setTrust).catch(() => {});
    }
    verifyChain().then(setChain).catch(() => {});
    getPendingApprovals().then(r => setPending(r.requests.filter(x => x.status === 'pending').length)).catch(() => {});
  }, []);

  const trustColor = (score: number) =>
    score >= 80 ? '#3fb950' : score >= 50 ? '#d29922' : '#f85149';

  return (
    <>
      <h1 className="page-title">Dashboard</h1>

      {!identity && (
        <div className="alert alert-info">
          No agent registered yet.{' '}
          <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onNavigate('register')}>
            Register your agent
          </span>{' '}
          to get started.
        </div>
      )}

      {/* Stats row */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-value" style={{ color: trust ? trustColor(trust.trust_score) : 'var(--muted)' }}>
            {trust ? trust.trust_score : '—'}
          </div>
          <div className="stat-label">Trust Score / 100</div>
          {trust && (
            <div className="trust-bar-bg">
              <div className="trust-bar-fill" style={{ width: `${trust.trust_score}%`, background: trustColor(trust.trust_score) }} />
            </div>
          )}
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: chain?.valid ? 'var(--green)' : 'var(--red)' }}>
            {chain ? chain.length : '—'}
          </div>
          <div className="stat-label">Audit Entries {chain && (chain.valid ? '✓ valid' : '⚠ broken')}</div>
        </div>
        <div className="card">
          <div className="stat-value" style={{ color: pending > 0 ? 'var(--yellow)' : 'var(--muted)' }}>
            {pending}
          </div>
          <div className="stat-label">Pending Approvals</div>
        </div>
      </div>

      {/* Identity card */}
      {identity && (
        <div className="card">
          <div className="card-title">Your Agent</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="AAP Address" value={identity.aap_address} accent />
            <Row label="DID" value={identity.did} mono />
            <Row label="Public Key" value={`${identity.public_key_hex.slice(0,24)}...`} mono />
            <Row label="Algorithm" value={identity.signature_algorithm} />
            <Row label="Registered" value={new Date(identity.registered_at).toLocaleString()} />
            <Row label="Verification" value={trust?.verification_level ?? 'unverified'} />
          </div>
        </div>
      )}

      {/* Trust breakdown */}
      {trust && (
        <div className="card">
          <div className="card-title">Trust Score Breakdown</div>
          <table>
            <thead><tr><th>Factor</th><th>Points</th></tr></thead>
            <tbody>
              <tr><td>Base</td><td>{trust.breakdown.base}</td></tr>
              <tr><td>Verification level</td><td>+{trust.breakdown.verification}</td></tr>
              <tr><td>Agent age (days, max 15)</td><td>+{trust.breakdown.age_days}</td></tr>
              <tr><td>Interactions (per 10, max 30)</td><td>+{trust.breakdown.interactions}</td></tr>
              <tr><td><strong>Total</strong></td><td><strong>{trust.trust_score}</strong></td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Quick actions */}
      <div className="card">
        <div className="card-title">Quick Actions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('connect')}>🔗 Connect to agent</button>
          <button className="btn btn-ghost"   onClick={() => onNavigate('audit')}>📋 View audit trail</button>
          {pending > 0 && (
            <button className="btn btn-ghost" style={{ borderColor: 'var(--yellow)', color: 'var(--yellow)' }} onClick={() => onNavigate('approvals')}>
              🔔 {pending} pending approval{pending > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <span style={{ minWidth: 120, color: 'var(--muted)', fontSize: 12 }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={accent ? { color: 'var(--accent)', fontWeight: 600 } : {}}>
        {value}
      </span>
    </div>
  );
}
