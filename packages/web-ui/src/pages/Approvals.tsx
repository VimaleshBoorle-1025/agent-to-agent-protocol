import { useEffect, useState } from 'react';
import { getPendingApprovals, approveRequest, type ApprovalRequest } from '../api/aap';

const CATEGORY_INFO: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: 'Routine',   color: 'badge-green',  desc: 'Auto-approved, logged only' },
  2: { label: 'Notable',   color: 'badge-blue',   desc: 'Notify owner, auto-approved' },
  3: { label: 'Sensitive', color: 'badge-yellow', desc: 'Blocked until human approves' },
  4: { label: 'Critical',  color: 'badge-red',    desc: 'Blocked + MFA required' },
};

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
    } catch { /* show in UI via status */ }
    finally { setActing(null); }
  }

  const pending  = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  const timeLeft = (expiresAt: number) => {
    const ms = expiresAt - Date.now();
    if (ms <= 0) return 'expired';
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
  };

  return (
    <>
      <h1 className="page-title">Human Auth Approvals</h1>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {[3, 4].map(cat => (
          <div className="card" key={cat}>
            <div className="card-title">Category {cat} — {CATEGORY_INFO[cat].label}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{CATEGORY_INFO[cat].desc}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><span className="spinner" /></div>
      ) : pending.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">✅</div>
          <div>No pending approvals.</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Pending ({pending.length})</div>
          {pending.map(r => {
            const cat = CATEGORY_INFO[r.category];
            return (
              <div key={r.id} style={{
                border: '1px solid var(--border)', borderRadius: 6, padding: 16, marginBottom: 12,
                borderLeft: `4px solid ${r.category >= 4 ? 'var(--red)' : 'var(--yellow)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${cat.color}`}>Cat {r.category} — {cat.label}</span>
                    <span className="badge badge-blue">{r.action_type}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>expires in {timeLeft(r.expires_at)}</span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                  Agent: <span className="mono">{r.agent_did.slice(0, 20)}...</span>
                </div>

                {Object.keys(r.payload).length > 0 && (
                  <pre style={{
                    background: 'var(--bg)', padding: 10, borderRadius: 6, fontSize: 12,
                    overflow: 'auto', marginBottom: 12, color: 'var(--text)',
                  }}>
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-green"
                    onClick={() => act(r.id, true)}
                    disabled={acting === r.id}
                  >
                    {acting === r.id ? <span className="spinner" /> : '✓ Approve'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => act(r.id, false)}
                    disabled={acting === r.id}
                  >
                    ✗ Deny
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="card">
          <div className="card-title">Recent Decisions</div>
          <table>
            <thead><tr><th>Action</th><th>Category</th><th>Decision</th><th>Time</th></tr></thead>
            <tbody>
              {resolved.slice(0, 10).map(r => (
                <tr key={r.id}>
                  <td><span className="badge badge-blue">{r.action_type}</span></td>
                  <td><span className={`badge ${CATEGORY_INFO[r.category]?.color}`}>{CATEGORY_INFO[r.category]?.label}</span></td>
                  <td>
                    <span className={`badge ${r.status === 'approved' ? 'badge-green' : 'badge-red'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
