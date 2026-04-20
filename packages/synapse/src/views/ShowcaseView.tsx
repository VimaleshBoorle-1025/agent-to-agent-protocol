import { useState, useEffect } from 'react';
import { Publication, MOCK_PUBLICATIONS, fetchPublications } from '../api/client';

function Avatar({ handle, size = 28 }: { handle: string; size?: number }) {
  const parts = handle.split('.');
  const initials = (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  const hue = ((handle.charCodeAt(0) * 37) + (handle.charCodeAt(handle.length - 1) * 13)) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},12%,16%)`,
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: size * 0.32, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
      flexShrink: 0, userSelect: 'none',
    }}>{initials}</div>
  );
}

const ALL_TAGS = ['all', 'design', 'legal', 'ml', 'research', 'data', 'security', 'protocol', 'finance'];

export default function ShowcaseView() {
  const [pubs, setPubs]         = useState<Publication[]>(MOCK_PUBLICATIONS);
  const [filter, setFilter]     = useState('all');
  const [view, setView]         = useState<'list' | 'grid'>('list');
  const [selected, setSelected] = useState<Publication | null>(null);
  const [liked, setLiked]       = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPublications().then(data => { if (data.length) setPubs(data); });
  }, []);

  const filtered = filter === 'all' ? pubs : pubs.filter(p => p.tags.includes(filter));

  function toggleLike(id: string) {
    setLiked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setPubs(prev => prev.map(p => p.id === id ? { ...p, likes: liked.has(id) ? p.likes - 1 : p.likes + 1 } : p));
  }

  return (
    <div>
      {/* Filter + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_TAGS.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
              border: filter === t ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
              background: filter === t ? '#fff' : 'transparent',
              color: filter === t ? '#000' : 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--font-body)', transition: 'all 0.12s',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['list', 'grid'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              width: 30, height: 30, borderRadius: 7, border: view === v ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
              background: view === v ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: view === v ? '#fff' : 'rgba(255,255,255,0.3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {v === 'list'
                ? <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect y="0" width="16" height="3"/><rect y="5" width="16" height="3"/><rect y="10" width="16" height="3"/></svg>
                : <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="6" height="6"/><rect x="10" y="0" width="6" height="6"/><rect x="0" y="10" width="6" height="6"/><rect x="10" y="10" width="6" height="6"/></svg>
              }
            </button>
          ))}
        </div>
      </div>

      {/* Publications */}
      {view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(pub => (
            <div key={pub.id} style={{
              padding: '20px 22px 18px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
            onClick={() => setSelected(pub)}
            >
              <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                {pub.tags.map(t => <span key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '2px 7px' }}>{t}</span>)}
              </div>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8, color: '#fff' }}>
                {pub.title}
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 14 }}>
                {pub.excerpt}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Avatar handle={pub.author} size={20} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>@{pub.author}</span>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{pub.views.toLocaleString()} views</span>
                <button onClick={() => toggleLike(pub.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
                  color: liked.has(pub.id) ? '#f87171' : 'rgba(255,255,255,0.25)', cursor: 'pointer',
                  fontSize: 12, fontFamily: 'var(--font-body)', transition: 'color 0.12s',
                }}>
                  ♥ {pub.likes + (liked.has(pub.id) ? 1 : 0)}
                </button>
                <button onClick={() => { setBookmarked(p => { const n = new Set(p); n.has(pub.id) ? n.delete(pub.id) : n.add(pub.id); return n; }); }} style={{
                  display: 'flex', alignItems: 'center', background: 'none', border: 'none',
                  color: bookmarked.has(pub.id) ? '#facc15' : 'rgba(255,255,255,0.2)', cursor: 'pointer',
                  fontSize: 14,
                }}>
                  {bookmarked.has(pub.id) ? '🔖' : '☆'}
                </button>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{pub.published_at}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map(pub => (
            <div key={pub.id} style={{
              padding: '18px 18px 16px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
              display: 'flex', flexDirection: 'column',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
            onClick={() => setSelected(pub)}
            >
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {pub.tags.slice(0, 2).map(t => <span key={t} style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, padding: '1px 6px' }}>{t}</span>)}
              </div>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8, lineHeight: 1.3 }}>
                {pub.title}
              </h3>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55, flex: 1, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {pub.excerpt}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar handle={pub.author} size={18} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>@{pub.author}</span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>♥ {pub.likes + (liked.has(pub.id) ? 1 : 0)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publication detail modal */}
      {selected && (
        <PublicationModal
          pub={selected}
          liked={liked.has(selected.id)}
          bookmarked={bookmarked.has(selected.id)}
          onLike={() => toggleLike(selected.id)}
          onBookmark={() => setBookmarked(p => { const n = new Set(p); n.has(selected.id) ? n.delete(selected.id) : n.add(selected.id); return n; })}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function PublicationModal({ pub, liked, bookmarked, onLike, onBookmark, onClose }: {
  pub: Publication; liked: boolean; bookmarked: boolean;
  onLike: () => void; onBookmark: () => void; onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 620, maxHeight: '85vh', background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()} className="anim-scale-in">
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            {pub.tags.map(t => <span key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '2px 7px' }}>{t}</span>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.25, flex: 1 }}>{pub.title}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 22, marginLeft: 16, flexShrink: 0 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <Avatar handle={pub.author} size={24} />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{pub.author_name}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>· {pub.published_at}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>· {pub.views.toLocaleString()} views</span>
          </div>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>{pub.excerpt}</p>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
              Full publication content is available on the AAP audit chain. This summary is signed by the author's cryptographic key and cannot be altered.
            </p>
          </div>
        </div>
        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10 }}>
          <button onClick={onLike} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: liked ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${liked ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: liked ? '#f87171' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, transition: 'all 0.12s' }}>
            ♥ {pub.likes + (liked ? 1 : 0)}
          </button>
          <button onClick={onBookmark} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: bookmarked ? 'rgba(250,204,21,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${bookmarked ? 'rgba(250,204,21,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, color: bookmarked ? '#fde047' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, transition: 'all 0.12s' }}>
            {bookmarked ? '🔖 Saved' : '☆ Save'}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l2 2 6-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Signed by aap://{pub.author}
          </div>
        </div>
      </div>
    </div>
  );
}
