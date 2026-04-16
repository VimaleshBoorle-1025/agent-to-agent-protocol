import { useState } from 'react';
import { loadIdentity, registerAgent, clearIdentity, type AgentIdentity } from '../api/aap';

export default function Register({ onIdentityChange }: { onIdentityChange?: () => void }) {
  const [identity, setIdentity] = useState<AgentIdentity | null>(loadIdentity);
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  async function handleRegister() {
    if (!name.trim()) { setError('Agent name is required'); return; }
    if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(name)) {
      setError('Name must be lowercase alphanumeric, dot-separated — e.g. alice.finance');
      return;
    }
    setLoading(true); setError(''); setSuccess('');
    try {
      const id = await registerAgent(name.trim());
      setIdentity(id);
      setSuccess(`Agent registered successfully as aap://${name}`);
      onIdentityChange?.();
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
    onIdentityChange?.();
  }

  const preview = name ? `aap://${name}` : 'aap://your.agent.name';

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">My Agent</h1>
        <p className="page-subtitle">Manage your cryptographic identity on the AAP network</p>
      </div>

      {identity ? (
        <>
          <div className="alert alert-success">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span>Agent is registered and active on the network.</span>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-label">Identity</div>
              <span className="badge badge-green">Active</span>
            </div>
            <div className="field-list">
              {[
                { label: 'AAP Address',  value: identity.aap_address,                              accent: true },
                { label: 'DID',          value: identity.did,                                      mono: true  },
                { label: 'Public Key',   value: identity.public_key_hex,                           mono: true  },
                { label: 'Algorithm',    value: identity.signature_algorithm                                   },
                { label: 'Registered',   value: new Date(identity.registered_at).toLocaleString()             },
              ].map(f => (
                <div className="field-row" key={f.label}>
                  <span className="field-label">{f.label}</span>
                  <span className={`field-value${f.mono ? ' mono' : ''}${f.accent ? ' accent' : ''}`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="danger-zone">
            <div className="card-header" style={{ marginBottom: 10 }}>
              <div className="card-title" style={{ color: 'var(--red)' }}>Danger Zone</div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
              Clearing your identity removes the private key from this browser permanently.
              You will not be able to sign messages as this agent again. A new registration will
              generate a different DID.
            </p>
            <button className="btn btn-danger" onClick={handleClear}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              Clear identity
            </button>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-label">Register a New Agent</div>
          </div>

          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-group">
            <label className="form-label">Agent Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="alice.finance"
              value={name}
              onChange={e => setName(e.target.value.toLowerCase())}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
            />
            <div className="form-hint">
              Will be registered as{' '}
              <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {preview}
              </span>
            </div>
          </div>

          <div className="info-box" style={{ marginBottom: 22 }}>
            <strong>What happens when you register:</strong>
            <div className="step-list" style={{ marginTop: 10 }}>
              <div className="step-item">An ECDSA P-256 key pair is generated in your browser using Web Crypto API</div>
              <div className="step-item">The registration payload is signed with your private key</div>
              <div className="step-item">Your agent is published to the AAP Registry with a unique DID</div>
              <div className="step-item">Your private key stays in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-3)', padding: '1px 5px', borderRadius: 4 }}>localStorage</code> — it never leaves your browser</div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>
            {loading ? <><span className="spinner" /> Registering…</> : (
              <>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd"/>
                </svg>
                Register agent
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
