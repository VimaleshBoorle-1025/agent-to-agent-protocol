import { useEffect, useState } from 'react';
import { getAuditChain, verifyChain, type AuditEntry } from '../api/aap';

const LIMIT = 25;

export default function Audit() {
  const [entries,  setEntries]  = useState<AuditEntry[]>([]);
  const [validity, setValidity] = useState<{ valid: boolean; length: number; broken_at?: number } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [offset,   setOffset]   = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([getAuditChain(LIMIT, offset), verifyChain()])
      .then(([chain, v]) => { setEntries(chain.entries); setValidity(v); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [offset]);

  const outcomeClass = (o: string) =>
    o === 'success' ? 'badge-green' : o === 'denied' ? 'badge-red' : 'badge-yellow';

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Audit Trail</h1>
        <p className="page-subtitle">Immutable hash chain — every agent action recorded and verifiable</p>
      </div>

      {validity && (
        <div className={`alert ${validity.valid ? 'alert-success' : 'alert-error'}`}>
          {validity.valid ? (
            <>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span>Chain integrity verified — {validity.length} entries, all hashes valid</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <span>Chain broken at entry {validity.broken_at} — tamper detected</span>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-label">Entries</div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Each entry's hash includes the previous
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <span className="spinner" style={{ width: 20, height: 20 }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>
            <div className="empty-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="empty-title">No audit entries yet</div>
            <div className="empty-desc">Entries will appear as agents perform actions on the network.</div>
          </div>
        ) : (
          <div className="table-wrap">
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
                    <td style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.id}</td>
                    <td><span className="badge badge-violet">{e.action_type}</span></td>
                    <td><span className={`badge ${outcomeClass(e.outcome)}`}>{e.outcome}</span></td>
                    <td className="mono" style={{ fontSize: 11 }}>{e.agent_did_hash.slice(0, 14)}…</td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>{e.entry_hash.slice(0, 16)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
          >
            ← Previous
          </button>
          <span className="pagination-info">
            {entries.length > 0 ? `${offset + 1}–${offset + entries.length}` : '0 entries'}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setOffset(offset + LIMIT)}
            disabled={entries.length < LIMIT}
          >
            Next →
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="card">
        <div className="card-header">
          <div className="card-label">How the Chain Works</div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
          Each entry is hashed as:
        </p>
        <div className="code-block">
          SHA-256(prev_hash ‖ agent_did_hash ‖ action_type ‖ outcome ‖ timestamp ‖ content_hash)
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 14, lineHeight: 1.6 }}>
          If any entry is tampered, all subsequent hashes break — making forgery detectable immediately.
          Agent DIDs are hashed before storage to preserve privacy.
        </p>
      </div>
    </>
  );
}
