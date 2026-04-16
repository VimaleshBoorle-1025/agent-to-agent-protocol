import { useEffect, useState } from 'react';
import { getPendingApprovals, approveRequest, type ApprovalRequest } from '../api/aap';

const CATEGORY: Record<number, { label: string; badgeClass: string; desc: string }> = {
  1: { label: 'Routine',   badgeClass: 'badge-green',  desc: 'Auto-approved, logged only' },
  2: { label: 'Notable',   badgeClass: 'badge-blue',   desc: 'Notify owner, auto-approved' },
  3: { label: 'Sensitive', badgeClass: 'badge-yellow', desc: 'Blocked until human approves' },
  4: { label: 'Critical',  badgeClass: 'badge-red',    desc: 'Blocked · MFA required' },
};

function timeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

export default function Approvals() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string | null>(null);

  function load() {
    setLoading(true);
    getPendingApprovals()
      .then(r => setRequests(r.requests))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function act(id: string, approve: boolean) {
    setActing(id);
    try {
      await approveRequest(id, approve);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: approve ? 'approved' : 'denied' } : r));
    } catch { /* noop */ }
    finally { setActing(null); }
  }

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Approvals</h1>
        <p className="page-subtitle">Review and authorize sensitive agent actions requiring human oversight</p>
      </div>

      {/* Category reference */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {[3, 4].map(cat => {
          const c = CATEGORY[cat];
          return (
            <div className="card" key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className={`badge ${c.badgeClass}`}>Cat {cat}</span>
                <span style={{ font: '600 13px var(--font)', color: 'var(--text)' }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.desc}</div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <span className="spinner" style={{ width: 20, height: 20 }} />
        </div>
      ) : pending.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="empty-title">All clear</div>
          <div className="empty-desc">No pending approvals at this time.</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-label">Pending</div>
            <span className="badge badge-yellow">{pending.length} waiting</span>
          </div>

          {pending.map(r => {
            const cat = CATEGORY[r.category];
            const isCritical = r.category >= 4;
            return (
              <div key={r.id} className={`approval-card ${isCritical ? 'critical' : 'sensitive'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${cat.badgeClass}`}>Cat {r.category} — {cat.label}</span>
                    <span className="badge badge-violet">{r.action_type}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Expires in {timeLeft(r.expires_at)}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10 }}>
                  Agent: <span className="mono">{r.agent_did.slice(0, 24)}…</span>
                </div>

                {Object.keys(r.payload).length > 0 && (
                  <pre className="code-block" style={{ marginBottom: 14, fontSize: 12 }}>
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-success"
                    onClick={() => act(r.id, true)}
                    disabled={acting === r.id}
                  >
                    {acting === r.id ? <span className="spinner" /> : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        Approve
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => act(r.id, false)}
                    disabled={acting === r.id}
                  >
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                    Deny
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-label">Recent Decisions</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Action</th><th>Category</th><th>Decision</th><th>Time</th></tr>
              </thead>
              <tbody>
                {resolved.slice(0, 10).map(r => (
                  <tr key={r.id}>
                    <td><span className="badge badge-violet">{r.action_type}</span></td>
                    <td><span className={`badge ${CATEGORY[r.category]?.badgeClass}`}>{CATEGORY[r.category]?.label}</span></td>
                    <td><span className={`badge ${r.status === 'approved' ? 'badge-green' : 'badge-red'}`}>{r.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
