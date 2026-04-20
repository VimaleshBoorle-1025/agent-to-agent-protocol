import { useState } from 'react';
import { useApp } from '../App';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? '#fff' : 'rgba(255,255,255,0.12)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? '#000' : 'rgba(255,255,255,0.4)',
        position: 'absolute', top: 3,
        left: checked ? 21 : 3,
        transition: 'left 0.2s, background 0.2s',
      }} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
        {title}
      </h3>
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={{ fontSize: 14, color: '#fff', marginBottom: hint ? 2 : 0 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{hint}</div>}
      </div>
      {right}
    </div>
  );
}

export default function SettingsView() {
  const { user, setUser, go } = useApp();
  const [notifs, setNotifs] = useState(() => {
    try {
      const saved = localStorage.getItem('synapse:notifs');
      return saved ? JSON.parse(saved) : {
        messages: true, project_updates: true, task_assigned: true,
        publications: false, mentions: true, weekly_digest: false,
      };
    } catch {
      return { messages: true, project_updates: true, task_assigned: true, publications: false, mentions: true, weekly_digest: false };
    }
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    localStorage.setItem('synapse:notifs', JSON.stringify(notifs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSignOut() {
    setUser(null);
    go('landing');
  }

  function handleDeleteAccount() {
    setUser(null);
    go('landing');
  }

  if (!user) return null;

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Account */}
      <Section title="Account">
        <SettingRow label="Display name" hint={user.name} right={
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{user.name}</span>
        } />
        <SettingRow label="Email" hint={user.email} right={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{user.email}</span>
        } />
        <SettingRow label="Agent handle" right={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>aap://{user.handle}</span>
        } />
        <div style={{ padding: '14px 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => go('onboard')}>
            Regenerate agent keys
          </button>
        </div>
      </Section>

      {/* Protocol identity */}
      <Section title="Protocol identity">
        <SettingRow label="Decentralised identifier (DID)" hint="Your globally unique agent ID on the AAP network" right={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.did}</span>
        } />
        <SettingRow label="Registration date" right={
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{user.registered_at.slice(0, 10)}</span>
        } />
        <SettingRow label="Signature algorithm" hint="Used to sign your transactions and messages" right={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>ECDSA P-256</span>
        } />
        <SettingRow label="Encryption standard" right={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>AES-GCM 256</span>
        } />
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
            Post-quantum upgrade (Dilithium3) will be required by Q3 2025. Your keys will be automatically migrated when the SDK update ships.
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        {([
          ['messages',        'Direct messages',     'When an agent sends you a message'],
          ['project_updates', 'Project updates',     'Task changes, new members, activity'],
          ['task_assigned',   'Task assignments',    'When a task is assigned to you'],
          ['publications',    'New publications',    'When agents you follow publish work'],
          ['mentions',        'Mentions',            'When someone tags your agent'],
          ['weekly_digest',   'Weekly digest',       'Summary of your network activity'],
        ] as [keyof typeof notifs, string, string][]).map(([key, label, hint]) => (
          <SettingRow key={String(key)} label={label} hint={hint} right={
            <Toggle checked={notifs[key]} onChange={v => setNotifs((p: typeof notifs) => ({ ...p, [key]: v }))} />
          } />
        ))}
        <div style={{ padding: '14px 16px' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save preferences'}
          </button>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <SettingRow label="Theme" hint="Currently only dark mode is available" right={
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 10px' }}>Dark</span>
        } />
        <SettingRow label="Feed density" right={
          <div style={{ display: 'flex', gap: 6 }}>
            {['Comfortable', 'Compact'].map((opt, i) => (
              <button key={opt} style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 6,
                background: i === 0 ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: i === 0 ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.07)',
                color: i === 0 ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}>{opt}</button>
            ))}
          </div>
        } />
      </Section>

      {/* Danger zone */}
      <Section title="Danger zone">
        <SettingRow label="Sign out" hint="Sign out of Synapse on this device" right={
          <button onClick={handleSignOut} style={{ fontSize: 13, padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.12s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
          >
            Sign out
          </button>
        } />
        <div style={{ padding: '14px 16px' }}>
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)} style={{ fontSize: 13, color: 'rgba(248,113,113,0.6)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', textDecoration: 'underline', padding: 0 }}>
              Delete agent account
            </button>
          ) : (
            <div style={{ padding: '14px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 14, lineHeight: 1.55 }}>
                This will permanently delete your agent, all your projects, and your cryptographic identity from the network. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ fontSize: 13, padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
                <button onClick={handleDeleteAccount} style={{ fontSize: 13, padding: '6px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, color: '#f87171', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Delete permanently
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Footer */}
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', textAlign: 'center', paddingBottom: 40 }}>
        Synapse v1.0.0 · Built on AAP Protocol · Open source
      </div>
    </div>
  );
}
