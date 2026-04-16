import { useEffect, useState } from 'react';
import { getAuditChain, verifyChain, type AuditEntry } from '../api/aap';

export default function Audit() {
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [validity, setValidity] = useState<{ valid: boolean; length: number; broken_at?: number } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [offset,  setOffset]    = useState(0);
  const LIMIT = 25;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAuditChain(LIMIT, offset),
      verifyChain(),
    ]).then(([chain, v]) => {
      setEntries(chain.entries);
      setValidity(v);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [offset]);

  const outcomeColor = (o: string) =>
    o === 'success' ? 'badge-green' : o === 'denied' ? 'badge-red' : 'badge-yellow';

  return (
    <>
      <h1 className="page-title">Audit Trail</h1>

      {validity && (
        <div className={`alert ${validity.valid ? 'alert-success' : 'alert-error'}`}>
          {validity.valid
            ? `✓ Chain integrity verified — ${validity.length} entries, all hashes valid`
            : `⚠ Chain broken at entry ${validity.broken_at} — tamper detected`}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Entries</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Each entry's hash includes the previous — forming an immutable chain
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><span className="spinner" /></div>
        ) : entries.length === 0 ? (
          <div className="empty"><div className="empty-icon">📋</div><div>No audit entries yet.</div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Action</th>
                <th>Outcome</th>
                <th>Agent (hashed)</th>
                <th>Timestamp</th>
                <th>Entry Hash</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td style={{ color: 'var(--muted)' }}>{e.id}</td>
                  <td><span className="badge badge-blue">{e.action_type}</span></td>
                  <td><span className={`badge ${outcomeColor(e.outcome)}`}>{e.outcome}</span></td>
                  <td className="mono" style={{ fontSize: 11 }}>{e.agent_did_hash.slice(0, 12)}...</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>{e.entry_hash.slice(0, 16)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}>
            ← Previous
          </button>
          <span style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: 13 }}>
            {offset + 1}–{offset + entries.length}
          </span>
          <button className="btn btn-ghost" onClick={() => setOffset(offset + LIMIT)} disabled={entries.length < LIMIT}>
            Next →
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">How the chain works</div>
        <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>
          <p>Each entry is hashed as:</p>
          <code style={{ display: 'block', background: 'var(--bg)', padding: 10, borderRadius: 6, margin: '8px 0', fontSize: 12 }}>
            SHA-256(prev_hash + agent_did_hash + action_type + outcome + timestamp + content_hash)
          </code>
          <p>
            If any entry is tampered, all subsequent hashes break — making forgery detectable immediately.
            Agent DIDs are hashed before storage for privacy.
          </p>
        </div>
      </div>
    </>
  );
}
