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

export default function Connect({ onChat }: { onChat: () => void }) {
  const identity = loadIdentity();
  const [address,  setAddress]  = useState('');
  const [remote,   setRemote]   = useState<RemoteAgent | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [connected, setConnected] = useState(false);

  async function handleLookup() {
    if (!address.startsWith('aap://')) { setError('Address must start with aap://'); return; }
    setLoading(true); setError(''); setRemote(null); setConnected(false);
    try {
      const data = await lookupAgent(address);
      setRemote(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    // In a full implementation this would trigger the SDK handshake.
    // For the UI demo, we store the remote address and navigate to chat.
    sessionStorage.setItem('aap:remote', JSON.stringify({ address, remote }));
    setConnected(true);
    setTimeout(onChat, 800);
  }

  const verBadge: Record<string, string> = {
    enterprise:          'badge-purple',
    business_verified:   'badge-blue',
    personal_verified:   'badge-green',
    unverified:          'badge-yellow',
  };

  return (
    <>
      <h1 className="page-title">Connect to an Agent</h1>

      {!identity && (
        <div className="alert alert-error">You need to register your agent first before connecting.</div>
      )}

      <div className="card">
        <div className="card-title">Lookup by AAP address</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="aap://friend.finance.agent"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleLookup} disabled={loading || !identity}>
            {loading ? <span className="spinner" /> : '🔍 Lookup'}
          </button>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {remote && (
        <div className="card">
          <div className="card-title">Agent Found</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            <Row label="AAP Address" value={address} accent />
            <Row label="DID" value={remote.id ?? '—'} mono />
            <Row label="Public Key" value={`${(remote.verificationMethod?.[0]?.publicKeyHex ?? '').slice(0,24)}...`} mono />
            <Row label="Endpoint" value={remote.service?.[0]?.serviceEndpoint ?? 'N/A'} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ minWidth: 130, color: 'var(--muted)', fontSize: 12 }}>Trust Score</span>
              <span style={{ fontWeight: 700, color: remote.trustScore >= 70 ? 'var(--green)' : remote.trustScore >= 40 ? 'var(--yellow)' : 'var(--red)' }}>
                {remote.trustScore} / 100
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ minWidth: 130, color: 'var(--muted)', fontSize: 12 }}>Verification</span>
              <span className={`badge ${verBadge[remote.verificationLevel] ?? 'badge-yellow'}`}>
                {remote.verificationLevel}
              </span>
            </div>
          </div>

          <div style={{ background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: 6, padding: 12, marginBottom: 16, fontSize: 13 }}>
            <strong>What happens when you connect:</strong>
            <ol style={{ paddingLeft: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--muted)' }}>
              <li>Kyber768 post-quantum KEM key exchange</li>
              <li>Session key derived via HKDF-SHA256</li>
              <li>All messages encrypted with AES-256-GCM</li>
            </ol>
          </div>

          {connected ? (
            <div className="alert alert-success">Tunnel established! Redirecting to chat...</div>
          ) : (
            <button className="btn btn-green" onClick={handleConnect}>
              🔐 Connect &amp; open chat
            </button>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">Demo agents (always online)</div>
        <table>
          <thead><tr><th>Agent</th><th>Capabilities</th><th></th></tr></thead>
          <tbody>
            {[
              { addr: 'aap://demo.echo.agent',    caps: 'PING, REQUEST_DATA' },
              { addr: 'aap://demo.weather.agent', caps: 'PING, REQUEST_DATA' },
              { addr: 'aap://demo.finance.agent', caps: 'PING, REQUEST_QUOTE, READ_BANK_BALANCE' },
            ].map(a => (
              <tr key={a.addr}>
                <td className="mono" style={{ color: 'var(--accent)' }}>{a.addr}</td>
                <td style={{ color: 'var(--muted)' }}>{a.caps}</td>
                <td>
                  <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => { setAddress(a.addr); }}>
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
      <span style={{ minWidth: 130, color: 'var(--muted)', fontSize: 12 }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{ color: accent ? 'var(--accent)' : undefined }}>{value}</span>
    </div>
  );
}
