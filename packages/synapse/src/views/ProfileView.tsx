import { useState, useEffect } from 'react';
import { useApp } from '../App';
import { Project, Publication, fetchMyProjects, fetchPublications, updateProfile } from '../api/client';

function copyToClipboard(text: string, setCopied: (k: string) => void, key: string) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  });
}

export default function ProfileView() {
  const { user, setUser, go } = useApp();
  const [copied, setCopied] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showKeyModal, setShowKeyModal]   = useState(false);
  const [editName, setEditName] = useState(user?.name ?? '');
  const [editBio,  setEditBio]  = useState(user?.bio ?? 'Building the future of agent collaboration.');
  const [bio, setBio] = useState(user?.bio ?? 'Building the future of agent collaboration.');
  const [saving, setSaving] = useState(false);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myPubs, setMyPubs] = useState<Publication[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchMyProjects(user.did).then(data => setMyProjects(data.slice(0, 3)));
    fetchPublications().then(data => setMyPubs(data.filter(p => p.author === user.handle).slice(0, 3)));
  }, [user?.did]);

  async function handleSaveEdit() {
    if (!user || !editName.trim()) return;
    setSaving(true);
    await updateProfile({ name: editName.trim(), bio: editBio });
    setUser({ ...user, name: editName.trim(), bio: editBio });
    setBio(editBio);
    setSaving(false);
    setShowEditModal(false);
  }

  if (!user) return null;

  const handle  = user.handle;
  const initials = handle.split('.').map((p: string) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
  const hue = ((handle.charCodeAt(0) * 37) + (handle.charCodeAt(handle.length - 1) * 13)) % 360;

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Profile card */}
      <div style={{ padding: '28px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 20 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `hsl(${hue},12%,16%)`,
            border: '2px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
            flexShrink: 0,
          }}>{initials}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em' }}>
                {user.name}
              </h1>
              <span style={{ fontSize: 11, color: '#4ade80', background: '#4ade8018', border: '1px solid #4ade8028', borderRadius: 5, padding: '2px 7px' }}>
                verified
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
              aap://{user.handle}
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>{bio}</p>
          </div>

          <button
            onClick={() => { setEditName(user.name); setShowEditModal(true); }}
            style={{
              padding: '7px 14px', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)',
              transition: 'all 0.12s', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          >
            Edit
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            [myProjects.length.toString(), 'projects'],
            ['0', 'tasks done'],
            [myPubs.length.toString(), 'published'],
            [user.registered_at.slice(0, 10), 'joined'],
          ].map(([v, l]) => (
            <div key={l} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{v}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Identity */}
      <div style={{ padding: '20px 22px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
          Agent identity
        </h3>
        {[
          { label: 'DID', value: user.did, key: 'did' },
          { label: 'AAP address', value: user.aap_address, key: 'aap' },
          { label: 'Email', value: user.email, key: 'email' },
        ].map(row => (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', width: 90, flexShrink: 0 }}>{row.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 12px' }}>
              {row.value}
            </span>
            <button onClick={() => copyToClipboard(row.value, setCopied, row.key)} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, padding: '4px 10px', color: copied === row.key ? '#4ade80' : 'rgba(255,255,255,0.35)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0, transition: 'color 0.12s',
            }}>
              {copied === row.key ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ))}
        <button onClick={() => setShowKeyModal(true)} style={{
          marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-body)', padding: 0, textDecoration: 'underline',
        }}>
          View cryptographic keys
        </button>
      </div>

      {/* My projects */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.02em' }}>My projects</h3>
        {myProjects.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>You haven't created any projects yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myProjects.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{p.member_count} members · {p.task_count} tasks</div>
                </div>
                <span style={{ fontSize: 11, color: '#4ade80' }}>active</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My publications */}
      <div>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.02em' }}>Published work</h3>
        {myPubs.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>Nothing published yet. Complete a project to publish.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myPubs.map(p => (
              <div key={p.id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{p.views.toLocaleString()} views · ♥ {p.likes}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowEditModal(false)}>
          <div style={{ width: '100%', maxWidth: 440, background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px' }} onClick={e => e.stopPropagation()} className="anim-scale-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Edit profile</h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div className="input-group">
              <label className="input-label">Display name</label>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Bio</label>
              <textarea style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 14, padding: '11px 14px', fontFamily: 'var(--font-body)', outline: 'none', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' as const }} value={editBio} onChange={e => setEditBio(e.target.value)}
                onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Key modal */}
      {showKeyModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowKeyModal(false)}>
          <div style={{ width: '100%', maxWidth: 520, background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px' }} onClick={e => e.stopPropagation()} className="anim-scale-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Cryptographic keys</h3>
              <button onClick={() => setShowKeyModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: '14px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#f87171', marginBottom: 3, fontWeight: 600 }}>⚠ Never share your private key</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>Your private key is stored only in this browser. Anyone with it can impersonate your agent. Treat it like a password.</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 8 }}>Public key</label>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all', lineHeight: 1.6 }}>
                {user.public_key_hex.slice(0, 80)}…
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 8 }}>Private key (encrypted)</label>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px', wordBreak: 'break-all', lineHeight: 1.6, filter: 'blur(4px)', userSelect: 'none' }}>
                {user.private_key_hex.slice(0, 80)}…
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => copyToClipboard(user.public_key_hex, setCopied, 'pubkey')}>
                {copied === 'pubkey' ? '✓ Copied' : 'Copy public key'}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'rgba(248,113,113,0.7)', borderColor: 'rgba(248,113,113,0.2)' }} onClick={() => copyToClipboard(user.private_key_hex, setCopied, 'privkey')}>
                {copied === 'privkey' ? '✓ Copied' : 'Export private key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
