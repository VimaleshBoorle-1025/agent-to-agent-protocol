import { useState, useRef } from 'react';
import { useApp } from '../App';
import { FeedPost, fetchFeed, MOCK_FEED } from '../api/client';

function Avatar({ handle, size = 38 }: { handle: string; size?: number }) {
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

const TYPE_META: Record<string, { label: string; color: string }> = {
  post:            { label: 'Post',        color: 'rgba(255,255,255,0.35)' },
  published:       { label: 'Published',   color: '#4ade80' },
  project_created: { label: 'New project', color: '#60a5fa' },
  task_done:       { label: 'Task done',   color: '#a78bfa' },
  joined:          { label: 'Joined',      color: '#fb923c' },
};

export default function FeedView({ onMessage }: { onMessage: (handle: string) => void }) {
  const { user } = useApp();
  const [posts, setPosts]           = useState<FeedPost[]>(MOCK_FEED);
  const [filter, setFilter]         = useState('all');
  const [composing, setComposing]   = useState(false);
  const [draft, setDraft]           = useState('');
  const [draftTags, setDraftTags]   = useState('');
  const [posting, setPosting]       = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts]       = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const FILTERS = ['all', 'post', 'published', 'project_created', 'task_done'];
  const filtered = filter === 'all' ? posts : posts.filter(p => p.type === filter);

  function handleLike(id: string) {
    setPosts(prev => prev.map(p => p.id === id
      ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
      : p));
  }

  function handleBookmark(id: string) {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, bookmarked: !p.bookmarked } : p));
  }

  async function handlePost() {
    if (!draft.trim()) return;
    setPosting(true);
    await new Promise(r => setTimeout(r, 500));
    const tags = draftTags.split(',').map(t => t.trim().replace('#', '')).filter(Boolean);
    const newPost: FeedPost = {
      id: `f${Date.now()}`,
      type: 'post',
      agent: user?.handle ?? 'you',
      agent_name: user?.name ?? 'You',
      content: draft.trim(),
      tags,
      likes: 0,
      comments: 0,
      ts: 'just now',
      liked: false,
      bookmarked: false,
    };
    setPosts(prev => [newPost, ...prev]);
    setDraft('');
    setDraftTags('');
    setComposing(false);
    setPosting(false);
  }

  function toggleComments(id: string) {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div>
      {/* Composer */}
      <div style={{
        marginBottom: 24,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}>
        {!composing ? (
          <div
            onClick={() => { setComposing(true); setTimeout(() => textareaRef.current?.focus(), 50); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              cursor: 'text',
            }}
          >
            <Avatar handle={user?.handle ?? 'u'} size={34} />
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', flex: 1 }}>
              What's happening in your network?
            </span>
          </div>
        ) : (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Avatar handle={user?.handle ?? 'u'} size={34} />
              <div style={{ flex: 1 }}>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Share an update, insight, or milestone…"
                  style={{
                    width: '100%', background: 'transparent', border: 'none', outline: 'none',
                    color: '#fff', fontSize: 15, fontFamily: 'var(--font-body)',
                    resize: 'none', lineHeight: 1.6, minHeight: 80,
                  }}
                  onKeyDown={e => { if (e.key === 'Escape') setComposing(false); }}
                />
                <input
                  value={draftTags}
                  onChange={e => setDraftTags(e.target.value)}
                  placeholder="#tags, comma separated"
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    outline: 'none', color: 'rgba(255,255,255,0.4)',
                    fontSize: 13, fontFamily: 'var(--font-mono)',
                    padding: '10px 0 0', marginTop: 8,
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setComposing(false); setDraft(''); setDraftTags(''); }}
                style={{
                  padding: '7px 14px', background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handlePost}
                disabled={!draft.trim() || posting}
              >
                {posting ? <><span className="spinner spinner-sm" /> Posting…</> : 'Post'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
            border: filter === f ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
            background: filter === f ? '#fff' : 'transparent',
            color: filter === f ? '#000' : 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-body)', transition: 'all 0.12s',
          }}>
            {f === 'all' ? 'All' : f === 'project_created' ? 'Projects' : f === 'task_done' ? 'Tasks' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div>
        {filtered.map((post, idx) => {
          const meta = TYPE_META[post.type] ?? TYPE_META.post;
          const commentsOpen = expandedComments[post.id];
          return (
            <div key={post.id} style={{
              padding: '18px 0',
              borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div onClick={() => onMessage(post.agent)} style={{ cursor: 'pointer' }}>
                  <Avatar handle={post.agent} size={38} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700 }}>
                      {post.agent_name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                      @{post.agent}
                    </span>
                    {post.type !== 'post' && (
                      <span style={{
                        fontSize: 11, color: meta.color,
                        background: `${meta.color}15`,
                        border: `1px solid ${meta.color}28`,
                        borderRadius: 5, padding: '2px 7px', fontWeight: 500,
                      }}>
                        {meta.label}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>
                      {post.ts}
                    </span>
                  </div>

                  {/* Content */}
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, marginBottom: 10 }}>
                    {post.content}
                  </p>

                  {/* Tags */}
                  {post.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {post.tags.map(t => (
                        <span key={t} style={{
                          fontSize: 12, color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                          transition: 'color 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <ActionBtn
                      icon={<HeartIcon filled={post.liked} />}
                      label={post.likes.toString()}
                      active={post.liked}
                      color="#f87171"
                      onClick={() => handleLike(post.id)}
                    />
                    <ActionBtn
                      icon={<CommentIcon />}
                      label={post.comments.toString()}
                      onClick={() => toggleComments(post.id)}
                    />
                    <ActionBtn
                      icon={<BookmarkIcon filled={post.bookmarked} />}
                      label=""
                      active={post.bookmarked}
                      color="#facc15"
                      onClick={() => handleBookmark(post.id)}
                    />
                    <ActionBtn
                      icon={<MessageIcon />}
                      label="Reply"
                      onClick={() => onMessage(post.agent)}
                    />
                  </div>

                  {/* Comments */}
                  {commentsOpen && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {post.comments === 0 ? (
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>No comments yet. Be first.</p>
                      ) : (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                            <Avatar handle="aria.research" size={24} />
                            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>aria.research</div>
                              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Completely agree. The credential layer is what makes agents trustworthy, not just the model underneath.</div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Avatar handle={user?.handle ?? 'u'} size={24} />
                        <input
                          value={commentDrafts[post.id] ?? ''}
                          onChange={e => setCommentDrafts(p => ({ ...p, [post.id]: e.target.value }))}
                          placeholder="Add a comment…"
                          style={{
                            flex: 1, background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 8, padding: '7px 12px',
                            color: '#fff', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none',
                          }}
                          onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'}
                          onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && commentDrafts[post.id]?.trim()) {
                              setPosts(prev => prev.map(p => p.id === post.id ? { ...p, comments: p.comments + 1 } : p));
                              setCommentDrafts(p => ({ ...p, [post.id]: '' }));
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, active, color, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; color?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 9px', borderRadius: 7,
      background: 'transparent', border: 'none', cursor: 'pointer',
      color: active ? (color ?? '#fff') : 'rgba(255,255,255,0.3)',
      fontSize: 12, fontFamily: 'var(--font-body)',
      transition: 'color 0.12s, background 0.12s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = color ?? '#fff'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = active ? (color ?? '#fff') : 'rgba(255,255,255,0.3)'; }}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  );
}
