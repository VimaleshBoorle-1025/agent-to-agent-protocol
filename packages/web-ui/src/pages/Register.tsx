import { useState } from 'react';
import { loadIdentity, registerAgent, clearIdentity, type AgentIdentity } from '../api/aap';

export default function Register() {
  const [identity, setIdentity] = useState<AgentIdentity | null>(loadIdentity);
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  async function handleRegister() {
    if (!name.trim()) { setError('Agent name is required'); return; }
    if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(name)) {
      setError('Name must be lowercase alphanumeric, dot-separated (e.g. vimalesh.finance)');
      return;
    }
    setLoading(true); setError(''); setSuccess('');
    try {
      const id = await registerAgent(name.trim());
      setIdentity(id);
      setSuccess(`Registered: aap://${name}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    clearIdentity();
    setIdentity(null);
    setSuccess('');
    setError('');
  }

  return (
    <>
      <h1 className="page-title">My Agent</h1>

      {identity ? (
        <>
          <div className="alert alert-success">Agent registered and active.</div>
          <div className="card">
            <div className="card-title">Identity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['AAP Address',  identity.aap_address,                            true,  false],
                ['DID',          identity.did,                                    false, true ],
                ['Public Key',   identity.public_key_hex,                         false, true ],
                ['Algorithm',    identity.signature_algorithm,                    false, false],
                ['Registered',   new Date(identity.registered_at).toLocaleString(), false, false],
              ].map(([label, value, accent, mono]) => (
                <div key={label as string} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ minWidth: 130, color: 'var(--muted)', fontSize: 12 }}>{label as string}</span>
                  <span className={mono ? 'mono' : ''} style={{ color: accent ? 'var(--accent)' : undefined, fontWeight: accent ? 600 : undefined, wordBreak: 'break-all' }}>
                    {value as string}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(248,81,73,0.3)' }}>
            <div className="card-title" style={{ color: 'var(--red)' }}>Danger Zone</div>
            <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>
              Clearing your identity removes the private key from this browser. You will not be able to sign
              messages as this agent again unless you re-register (which creates a new DID).
            </p>
            <button className="btn btn-danger" onClick={handleClear}>Clear identity</button>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-title">Register a new agent</div>

          {error   && <div className="alert alert-error"  style={{ marginBottom: 16 }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

          <div className="form-group">
            <label>Agent Name</label>
            <input
              type="text"
              placeholder="e.g. vimalesh.finance"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
              Will be registered as <strong style={{ color: 'var(--accent)' }}>aap://{name || 'your.agent.name'}</strong>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>What happens when you register:</div>
            <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--muted)' }}>
              <li>An Ed25519 key pair is generated in your browser</li>
              <li>The registration payload is signed with your private key</li>
              <li>Your agent is published to the AAP Registry with a unique DID</li>
              <li>Your private key is stored in <code>localStorage</code> (never leaves your browser)</li>
            </ol>
          </div>

          <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>
            {loading ? <><span className="spinner" /> Registering...</> : '🔑 Register agent'}
          </button>
        </div>
      )}
    </>
  );
}
