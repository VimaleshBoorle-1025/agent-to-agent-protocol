import { useState, useEffect } from 'react';
import { useApp, type SynapseUser } from '../App';
import Logo from '../components/Logo';

const AGENT_TYPES = [
  { id: 'research',     icon: '🔬', label: 'Researcher',  desc: 'Academic research, data analysis, literature review' },
  { id: 'creative',     icon: '🎨', label: 'Creator',     desc: 'Content, design, writing, media production' },
  { id: 'finance',      icon: '📊', label: 'Analyst',     desc: 'Financial modeling, market analysis, forecasting' },
  { id: 'engineering',  icon: '⚙️', label: 'Engineer',    desc: 'Code, infrastructure, technical problem solving' },
  { id: 'legal',        icon: '⚖️', label: 'Legal',       desc: 'Contracts, compliance, regulatory guidance' },
  { id: 'general',      icon: '✨', label: 'General',     desc: 'Versatile across multiple domains' },
];

const REGISTRY = (import.meta as any).env?.VITE_REGISTRY_URL || '/api/registry';

async function generateKeyPair(): Promise<{ publicKeyHex: string; privateKeyHex: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub  = await crypto.subtle.exportKey('raw',   kp.publicKey);
  const priv = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
  const hex  = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  return { publicKeyHex: hex(pub), privateKeyHex: hex(priv) };
}

async function signPayload(body: object, privHex: string): Promise<string> {
  const bytes = Uint8Array.from(privHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const key   = await crypto.subtle.importKey('pkcs8', bytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const msg   = new TextEncoder().encode(JSON.stringify(body));
  const sig   = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, msg);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

type Step = 'type' | 'name' | 'creating' | 'done';

export default function Onboard() {
  const { go, draft, setUser } = useApp();

  const [step,       setStep]       = useState<Step>('type');
  const [agentType,  setAgentType]  = useState('');
  const [handle,     setHandle]     = useState(draft.handle || '');
  const [error,      setError]      = useState('');
  const [progress,   setProgress]   = useState<string[]>([]);
  const [progDone,   setProgDone]   = useState<string[]>([]);

  // If no draft, go back
  useEffect(() => {
    if (!draft.name) go('signup');
  }, []);

  async function createAgent() {
    if (!handle.trim()) { setError('Agent handle is required'); return; }
    if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(handle)) {
      setError('Handle must be lowercase alphanumeric and dots only');
      return;
    }

    setError('');
    setStep('creating');

    const steps = [
      'Generating cryptographic key pair',
      'Signing registration payload',
      'Publishing to AAP Registry',
      'Activating your agent',
    ];

    // Animate progress steps
    for (let i = 0; i < steps.length; i++) {
      setProgress(steps.slice(0, i + 1));
      await new Promise(r => setTimeout(r, 600));
      if (i < 2) {
        setProgDone(steps.slice(0, i + 1));
      }
    }

    try {
      const kp          = await generateKeyPair();
      const aap_address = `aap://${handle}`;
      const timestamp   = Date.now();
      const nonce       = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join('');

      const bodyToSign = {
        aap_address,
        public_key_hex:  kp.publicKeyHex,
        endpoint_url:    `https://agent.synapse.app/${handle}`,
        capabilities:    agentType ? [agentType] : [],
        owner_type:      'human' as const,
        timestamp,
        nonce,
      };

      const signature = await signPayload(bodyToSign, kp.privateKeyHex);

      const res = await fetch(`${REGISTRY}/v1/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bodyToSign, signature }),
      });

      if (!res.ok) {
        const e = await res.json() as any;
        throw new Error(e.error || 'Registration failed');
      }

      const data = await res.json() as { did: string; aap_address: string };

      setProgDone(steps);
      await new Promise(r => setTimeout(r, 400));

      const user: SynapseUser = {
        name:            draft.name,
        email:           draft.email,
        handle,
        did:             data.did,
        aap_address:     data.aap_address,
        public_key_hex:  kp.publicKeyHex,
        private_key_hex: kp.privateKeyHex,
        registered_at:   new Date().toISOString(),
      };

      setUser(user);
      setStep('done');

    } catch (e: any) {
      setError(e.message);
      setStep('name');
      setProgress([]);
      setProgDone([]);
    }
  }

  const currentStepIndex = ['type', 'name', 'creating', 'done'].indexOf(step);

  return (
    <div style={{
      minHeight: '100vh', background: '#000', color: '#fff',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '22px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <Logo size="sm" />
        {step !== 'creating' && step !== 'done' && (
          <div className="step-dots">
            {['type', 'name'].map((s, i) => (
              <div key={s} className={`step-dot${s === step ? ' active' : i < currentStepIndex ? ' done' : ''}`} />
            ))}
          </div>
        )}
      </div>

      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>

        {/* ── Step 1: Agent type ── */}
        {step === 'type' && (
          <div style={{ width: '100%', maxWidth: 560 }} className="anim-fade-up">
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Step 1 of 2
              </div>
              <h1 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 28, fontWeight: 700,
                letterSpacing: '-0.04em', marginBottom: 8,
              }}>
                What kind of agent are you?
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                This helps other agents discover you. You can change this later.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
              {AGENT_TYPES.map(t => (
                <button
                  key={t.id}
                  className={`select-card${agentType === t.id ? ' selected' : ''}`}
                  onClick={() => setAgentType(t.id)}
                  style={{ color: '#fff' }}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 15, fontWeight: 600,
                    letterSpacing: '-0.02em', marginBottom: 4,
                  }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>

            <button
              className="btn btn-primary btn-full"
              style={{ height: 48, fontSize: 15, fontWeight: 600 }}
              onClick={() => setStep('name')}
              disabled={!agentType}
            >
              Continue
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── Step 2: Handle ── */}
        {step === 'name' && (
          <div style={{ width: '100%', maxWidth: 420 }} className="anim-fade-up">
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Step 2 of 2
              </div>
              <h1 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 28, fontWeight: 700,
                letterSpacing: '-0.04em', marginBottom: 8,
              }}>
                Name your agent
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                This is your agent's permanent address on the Synapse network.
              </p>
            </div>

            {error && (
              <div className="notice notice-error" style={{ marginBottom: 18 }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="input-group" style={{ marginBottom: 28 }}>
              <label className="input-label">Agent handle</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>@</span>
                <input
                  className="input"
                  type="text"
                  placeholder={`${draft.name.split(' ')[0]?.toLowerCase()}.${agentType}`}
                  value={handle}
                  onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && createAgent()}
                  autoFocus
                  style={{ paddingLeft: 30, fontSize: 16 }}
                />
              </div>

              {handle && (
                <div style={{
                  marginTop: 12, padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Your AAP address
                  </div>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 15, fontWeight: 600,
                    color: 'rgba(255,255,255,0.85)',
                    letterSpacing: '-0.02em',
                  }}>
                    aap://{handle}
                  </div>
                </div>
              )}

              <div className="input-hint" style={{ marginTop: 10 }}>
                Choose carefully — this address is permanent and publicly visible.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => setStep('type')}>
                ← Back
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, height: 48, fontSize: 15, fontWeight: 600 }}
                onClick={createAgent}
                disabled={!handle.trim()}
              >
                Launch my agent
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Creating ── */}
        {step === 'creating' && (
          <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }} className="anim-fade-in">
            {/* Animated logo */}
            <div style={{ marginBottom: 40, position: 'relative' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 22,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
                animation: 'pulse 2s ease infinite',
              }}>
                <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
                  <circle cx="11" cy="16" r="8" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
                  <circle cx="21" cy="16" r="8" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
                  <circle cx="16" cy="16" r="3" fill="rgba(255,255,255,0.8)"/>
                </svg>
              </div>
            </div>

            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 22, fontWeight: 700,
              letterSpacing: '-0.04em', marginBottom: 8,
            }}>
              Launching your agent
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 36 }}>
              Setting up your cryptographic identity on the network
            </p>

            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {['Generating cryptographic key pair', 'Signing registration payload', 'Publishing to AAP Registry', 'Activating your agent'].map((s, i) => {
                const isActive = progress.includes(s) && !progDone.includes(s);
                const isDone   = progDone.includes(s);
                const isPending = !progress.includes(s);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isDone ? (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      ) : isActive ? (
                        <span className="spinner" style={{ borderTopColor: '#fff' }} />
                      ) : (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', margin: '0 8px' }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: 14,
                      color: isDone ? 'rgba(255,255,255,0.7)' : isActive ? '#fff' : 'rgba(255,255,255,0.2)',
                      transition: 'color 0.3s',
                      fontWeight: isActive ? 500 : 400,
                    }}>
                      {s}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {step === 'done' && (
          <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }} className="anim-scale-in">
            {/* Success circle */}
            <div style={{ marginBottom: 32 }}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: 'rgba(74,222,128,0.08)',
                border: '2px solid rgba(74,222,128,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
                boxShadow: '0 0 40px rgba(74,222,128,0.12)',
              }}>
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <path
                    d="M10 19l6 6 12-12"
                    stroke="#4ade80"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="30"
                    strokeDashoffset="0"
                    style={{ animation: 'checkmark 0.4s ease forwards' }}
                  />
                </svg>
              </div>
            </div>

            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 28, fontWeight: 700,
              letterSpacing: '-0.04em', marginBottom: 8,
            }}>
              Your agent is live.
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
              Welcome to Synapse, {draft.name.split(' ')[0]}.
            </p>
            <p style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 14, color: 'rgba(255,255,255,0.3)',
              fontWeight: 600, letterSpacing: '-0.02em',
              marginBottom: 40,
              fontStyle: 'normal',
            }}>
              aap://{handle}
            </p>

            <button
              className="btn btn-primary btn-full"
              style={{ height: 52, fontSize: 16, fontWeight: 600 }}
              onClick={() => go('home')}
            >
              Enter Synapse
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
