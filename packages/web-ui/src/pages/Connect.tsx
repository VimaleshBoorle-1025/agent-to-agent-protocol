import { useState } from 'react';
import { loadIdentity, lookupAgent } from '../api/aap';

interface RemoteAgent {
  id: string;
  aapAddress?: string;
  trustScore: number;
  verificationLevel: string;
  service?: { serviceEndpoint: string }[];
  verificationMethod?: { publicKeyHex: string }[];
}

const DEMO_AGENTS = [
  { addr: 'aap://demo.echo.agent',    caps: 'PING · REQUEST_DATA',               desc: 'Echoes messages back' },
  { addr: 'aap://demo.weather.agent', caps: 'PING · REQUEST_DATA',               desc: 'Weather data queries' },
  { addr: 'aap://demo.finance.agent', caps: 'PING · REQUEST_QUOTE · READ_BALANCE', desc: 'Financial data agent' },
];

export default function Connect({ onChat }: { onChat: () => void }) {
  const identity = loadIdentity();
  const [address,   setAddress]   = useState('');
  const [remote,    setRemote]    = useState<RemoteAgent | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [connected, setConnected] = useState(false);

  async function handleLookup() {
    const addr = address.trim();
    if (!addr.startsWith('aap://')) { setError('Address must start with aap://'); return; }
    setLoading(true); setError(''); setRemote(null); setConnected(false);
    try {
      const data = await lookupAgent(addr);
      setRemote(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    sessionStorage.setItem('aap:remote', JSON.stringify({ address, remote }));
    setConnected(true);
    setTimeout(onChat, 800);
  }

  const verBadge: Record<string, string> = {
    enterprise:        'badge-violet',
    business_verified: 'badge-blue',
    personal_verified: 'badge-green',
    unverified:        'badge-yellow',
  };

  const trustColor = (s: number) => s >= 70 ? 'var(--green)' : s >= 40 ? 'var(--yellow)' : 'var(--red)';

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Connect</h1>
        <p className="page-subtitle">Find and establish an encrypted tunnel with another agent</p>
      </div>

      {!identity && (
        <div className="alert alert-warning">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <span>Register your agent first before connecting.</span>
        </div>
      )}

      {/* Lookup input */}
      <div className="card">
        <div className="card-header">
          <div className="card-label">Lookup Agent by AAP Address</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            className="form-input"
            placeholder="aap://friend.finance.agent"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleLookup}
            disabled={loading || !identity || !address.trim()}
          >
            {loading ? <span className="spinner" /> : (
              <>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
                </svg>
                Lookup
              </>
            )}
          </button>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 14, marginBottom: 0 }}>{error}</div>}
      </div>

      {/* Agent result */}
      {remote && (
        <div className="card">
          <div className="card-header">
            <div className="card-label">Agent Found</div>
            <span className={`badge ${verBadge[remote.verificationLevel] ?? 'badge-yellow'}`}>
              {remote.verificationLevel}
            </span>
          </div>

          <div className="field-list" style={{ marginBottom: 18 }}>
            <div className="field-row">
              <span className="field-label">AAP Address</span>
              <span className="field-value accent">{address}</span>
            </div>
            <div className="field-row">
              <span className="field-label">DID</span>
              <span className="field-value mono">{remote.id ?? '—'}</span>
            </div>
            <div className="field-row">
              <span className="field-label">Public Key</span>
              <span className="field-value mono">{(remote.verificationMethod?.[0]?.publicKeyHex ?? '').slice(0, 32)}…</span>
            </div>
            <div className="field-row">
              <span className="field-label">Endpoint</span>
              <span className="field-value mono">{remote.service?.[0]?.serviceEndpoint ?? 'N/A'}</span>
            </div>
            <div className="field-row">
              <span className="field-label">Trust Score</span>
              <span className="field-value" style={{ fontWeight: 700, color: trustColor(remote.trustScore) }}>
                {remote.trustScore} / 100
              </span>
            </div>
          </div>

          <div className="info-box" style={{ marginBottom: 18 }}>
            <strong>Encrypted tunnel setup:</strong>
            <div className="step-list" style={{ marginTop: 10 }}>
              <div className="step-item">Kyber768 post-quantum KEM key exchange</div>
              <div className="step-item">Session key derived via HKDF-SHA256</div>
              <div className="step-item">All messages encrypted with AES-256-GCM</div>
            </div>
          </div>

          {connected ? (
            <div className="alert alert-success">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span>Tunnel established. Redirecting to messages…</span>
            </div>
          ) : (
            <button className="btn btn-success" onClick={handleConnect}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
              </svg>
              Connect &amp; open chat
            </button>
          )}
        </div>
      )}

      {/* Demo agents */}
      <div className="card">
        <div className="card-header">
          <div className="card-label">Demo Agents</div>
          <span className="badge badge-green">Always online</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Capabilities</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {DEMO_AGENTS.map(a => (
                <tr key={a.addr}>
                  <td>
                    <span className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{a.addr}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{a.caps}</td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{a.desc}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setAddress(a.addr)}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
