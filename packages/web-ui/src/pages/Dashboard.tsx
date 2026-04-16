import { useEffect, useState } from 'react';
import { loadIdentity, getTrustScore, verifyChain, getPendingApprovals, type AgentIdentity, type TrustInfo } from '../api/aap';
import type { Page } from '../App';

export default function Dashboard({
  onNavigate,
  onPendingCount,
}: {
  onNavigate: (p: Page) => void;
  onPendingCount: (n: number) => void;
}) {
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
    getPendingApprovals()
      .then(r => {
        const n = r.requests.filter(x => x.status === 'pending').length;
        setPending(n);
        onPendingCount(n);
      })
      .catch(() => {});
  }, []);

  const trustColor = (s: number) =>
    s >= 80 ? 'var(--green)' : s >= 50 ? 'var(--yellow)' : 'var(--red)';

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">Agent identity, trust, and protocol status</p>
      </div>

      {!identity && (
        <div className="alert alert-info">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
          <span>
            No agent registered.{' '}
            <span
              style={{ textDecoration: 'underline', cursor: 'pointer', color: 'var(--accent-2)' }}
              onClick={() => onNavigate('register')}
            >
              Register your agent →
            </span>
          </span>
        </div>
      )}

      {/* Stat row */}
      <div className="stat-grid">
        {/* Trust Score */}
        <div className="stat-card">
          <div className="stat-label">Trust Score</div>
          <div className="stat-value" style={{ color: trust ? trustColor(trust.trust_score) : 'var(--text-3)' }}>
            {trust ? trust.trust_score : '—'}
            <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-3)', marginLeft: 4 }}>/100</span>
          </div>
          {trust ? (
            <>
              <div className="stat-meta" style={{ color: trust.trust_score >= 80 ? 'var(--green)' : trust.trust_score >= 50 ? 'var(--yellow)' : 'var(--red)' }}>
                {trust.trust_score >= 80 ? 'High trust' : trust.trust_score >= 50 ? 'Moderate trust' : 'Low trust'}
              </div>
              <div className="trust-bar">
                <div className="trust-bar-fill" style={{ width: `${trust.trust_score}%` }} />
              </div>
            </>
          ) : (
            <div className="stat-meta">Register to earn a score</div>
          )}
        </div>

        {/* Chain Health */}
        <div className="stat-card">
          <div className="stat-label">Audit Chain</div>
          <div className="stat-value" style={{ color: chain?.valid ? 'var(--green)' : 'var(--text-3)' }}>
            {chain ? chain.length : '—'}
          </div>
          <div className="stat-meta">
            {chain
              ? chain.valid
                ? <span style={{ color: 'var(--green)' }}>✓ Integrity verified</span>
                : <span style={{ color: 'var(--red)' }}>⚠ Chain broken</span>
              : 'Loading…'}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="stat-card">
          <div className="stat-label">Pending Approvals</div>
          <div className="stat-value" style={{ color: pending > 0 ? 'var(--yellow)' : 'var(--text-3)' }}>
            {pending}
          </div>
          <div className="stat-meta">
            {pending > 0
              ? <span style={{ color: 'var(--yellow)', cursor: 'pointer' }} onClick={() => onNavigate('approvals')}>Review now →</span>
              : 'All clear'}
          </div>
        </div>
      </div>

      {/* Identity card */}
      {identity && (
        <div className="card">
          <div className="card-header">
            <div className="card-label">Your Agent Identity</div>
            {trust && (
              <span className={`badge ${trust.verification_level === 'unverified' ? 'badge-yellow' : 'badge-green'}`}>
                {trust.verification_level}
              </span>
            )}
          </div>
          <div className="field-list">
            <FieldRow label="AAP Address" value={identity.aap_address} accent />
            <FieldRow label="DID" value={identity.did} mono />
            <FieldRow label="Public Key" value={`${identity.public_key_hex.slice(0, 32)}…`} mono />
            <FieldRow label="Algorithm" value={identity.signature_algorithm} />
            <FieldRow label="Registered" value={new Date(identity.registered_at).toLocaleString()} />
          </div>
        </div>
      )}

      {/* Trust breakdown */}
      {trust && (
        <div className="card">
          <div className="card-header">
            <div className="card-label">Trust Score Breakdown</div>
            <span style={{ fontSize: 20, fontWeight: 700, color: trustColor(trust.trust_score) }}>
              {trust.trust_score}
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Factor</th><th>Points</th><th>Max</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Base score</td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>{trust.breakdown.base}</td>
                  <td style={{ color: 'var(--text-3)' }}>40</td>
                </tr>
                <tr>
                  <td>Verification level</td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>+{trust.breakdown.verification}</td>
                  <td style={{ color: 'var(--text-3)' }}>35</td>
                </tr>
                <tr>
                  <td>Agent age (days)</td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>+{trust.breakdown.age_days}</td>
                  <td style={{ color: 'var(--text-3)' }}>15</td>
                </tr>
                <tr>
                  <td>Interaction history</td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>+{trust.breakdown.interactions}</td>
                  <td style={{ color: 'var(--text-3)' }}>30</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div className="card-label">Quick Actions</div>
        </div>
        <div className="action-grid">
          <button className="action-btn" onClick={() => onNavigate('connect')}>
            <span className="action-btn-icon">🔗</span>
            <span className="action-btn-label">Connect</span>
            <span className="action-btn-desc">Find &amp; connect to an agent</span>
          </button>
          <button className="action-btn" onClick={() => onNavigate('chat')}>
            <span className="action-btn-icon">💬</span>
            <span className="action-btn-label">Messages</span>
            <span className="action-btn-desc">Send encrypted messages</span>
          </button>
          <button className="action-btn" onClick={() => onNavigate('audit')}>
            <span className="action-btn-icon">🔍</span>
            <span className="action-btn-label">Audit Trail</span>
            <span className="action-btn-desc">Verify the hash chain</span>
          </button>
          {pending > 0 && (
            <button className="action-btn" style={{ borderColor: 'var(--yellow)' }} onClick={() => onNavigate('approvals')}>
              <span className="action-btn-icon">🔔</span>
              <span className="action-btn-label">Approvals</span>
              <span className="action-btn-desc" style={{ color: 'var(--yellow)' }}>{pending} pending</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function FieldRow({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className={`field-value${mono ? ' mono' : ''}${accent ? ' accent' : ''}`}>{value}</span>
    </div>
  );
}
