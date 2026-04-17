import { useState, useRef, useEffect } from 'react';
import { useApp } from '../App';
import Logo from '../components/Logo';

const CODE_LENGTH = 6;
const REGISTRY = import.meta.env.VITE_REGISTRY_URL || '';

export default function Verify() {
  const { go, draft, setUser } = useApp();
  const [digits,    setDigits]    = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error,     setError]     = useState('');
  const [resent,    setResent]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleChange(i: number, val: string) {
    const ch = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    setError('');
    if (ch && i < CODE_LENGTH - 1) inputRefs.current[i + 1]?.focus();
    // Auto-submit when all filled
    if (ch && i === CODE_LENGTH - 1) {
      const full = [...next].join('');
      if (full.length === CODE_LENGTH) setTimeout(() => verify(full), 80);
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; setDigits(next);
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputRefs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) {
      inputRefs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    if (pasted.length === CODE_LENGTH) setTimeout(() => verify(pasted), 80);
  }

  async function verify(code?: string) {
    const full = code ?? digits.join('');
    if (full.length < CODE_LENGTH) { setError('Enter the complete 6-digit code'); return; }
    setLoading(true);
    setError('');

    try {
      if (REGISTRY) {
        const r = await fetch(`${REGISTRY}/v1/auth/email/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: draft.email, otp: full, name: draft.name }),
        });
        if (!r.ok) {
          const d = await r.json();
          setError(d.error || 'Invalid or expired code');
          setLoading(false);
          return;
        }
        const data = await r.json();
        const { token, user: u, is_new } = data;

        // Map to SynapseUser and store
        setUser({
          id:              u.id       ?? '',
          name:            u.name     ?? draft.name,
          email:           u.email    ?? draft.email,
          handle:          u.handle   ?? '',
          did:             u.did      ?? '',
          aap_address:     u.aap_address ?? '',
          public_key_hex:  u.public_key_hex ?? '',
          private_key_hex: '',
          registered_at:   u.registered_at ?? new Date().toISOString(),
          auth_token:      token,
          avatar_url:      u.avatar_url ?? '',
        });

        go(is_new || !u.handle ? 'onboard' : 'home');
      } else {
        // Demo mode: any 6 digits work
        go('onboard');
      }
    } catch {
      setError('Could not verify. Check your connection.');
    }
    setLoading(false);
  }

  async function resend() {
    setResent(true);
    setCountdown(30);
    setDigits(Array(CODE_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
    if (REGISTRY) {
      try {
        await fetch(`${REGISTRY}/v1/auth/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: draft.email }),
        });
      } catch { /* silent */ }
    }
    setTimeout(() => setResent(false), 3000);
  }

  const filled = digits.filter(Boolean).length;

  return (
    <div style={{
      minHeight: '100vh', background: '#000', color: '#fff',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '22px 32px',
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ cursor: 'pointer' }} onClick={() => go('landing')}>
          <Logo size="sm" />
        </div>
      </div>

      {/* Centered content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }} className="anim-scale-in">

          {/* Icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>

          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 26, fontWeight: 700,
            letterSpacing: '-0.04em', marginBottom: 10,
          }}>
            Check your email
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 8, lineHeight: 1.6 }}>
            We sent a 6-digit code to
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 36 }}>
            {draft.email || 'your email address'}
          </p>

          {/* OTP inputs */}
          <div className="otp-row" style={{ marginBottom: 28 }} onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                className={`otp-input${d ? ' filled' : ''}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 24 }}>
            {Array(CODE_LENGTH).fill(0).map((_, i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: i < filled ? '#fff' : 'rgba(255,255,255,0.15)',
                transition: 'background 0.15s',
              }} />
            ))}
          </div>

          {error && (
            <div className="notice notice-error" style={{ marginBottom: 20, textAlign: 'left' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            style={{ height: 48, fontSize: 15, fontWeight: 600, marginBottom: 20 }}
            onClick={() => verify()}
            disabled={filled < CODE_LENGTH || loading}
          >
            {loading ? <><span className="spinner spinner-sm" /> Verifying…</> : 'Verify email'}
          </button>

          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
            {resent ? (
              <span style={{ color: '#4ade80' }}>✓ Code resent successfully</span>
            ) : countdown > 0 ? (
              <span>Resend in {countdown}s</span>
            ) : (
              <span>
                Didn't receive it?{' '}
                <span
                  style={{ color: '#fff', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={resend}
                >
                  Resend code
                </span>
              </span>
            )}
          </div>

          <button
            style={{
              marginTop: 28, background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.25)', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
            onClick={() => go('signup')}
          >
            ← Change email address
          </button>

          {/* Demo hint — only shown when no backend configured */}
          {!REGISTRY && (
            <div style={{
              marginTop: 32, padding: '12px 16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, fontSize: 12,
              color: 'rgba(255,255,255,0.3)', lineHeight: 1.5,
            }}>
              Demo mode: enter any 6 digits to continue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
