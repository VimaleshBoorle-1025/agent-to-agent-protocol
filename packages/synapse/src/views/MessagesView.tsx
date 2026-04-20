import { useState, useRef, useEffect } from 'react';
import { Conversation, Message, MOCK_AGENTS, MOCK_CONVERSATIONS, sendMessage, fetchConversations, fetchMessages } from '../api/client';
import { useApp } from '../App';

function Avatar({ handle, size = 36 }: { handle: string; size?: number }) {
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

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

export default function MessagesView({ initialConversation }: { initialConversation?: string }) {
  const { user } = useApp();
  const [convos, setConvos]         = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selected, setSelected]     = useState<string | null>(initialConversation ?? null);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [newSearch, setNewSearch]   = useState('');
  const [showMobileThread, setShowMobileThread] = useState(!!initialConversation);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConvo = convos.find(c => c.id === selected) ?? null;

  // Load real conversations on mount
  useEffect(() => {
    fetchConversations().then(data => {
      if (data.length) {
        setConvos(data);
        if (!selected) setSelected(data[0]?.id ?? null);
      } else if (!selected && MOCK_CONVERSATIONS.length) {
        setSelected(MOCK_CONVERSATIONS[0].id);
      }
    });
  }, []);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selected) return;
    const convo = convos.find(c => c.id === selected);
    if (!convo) return;
    // If messages not yet loaded, fetch them
    if (!convo.messages || convo.messages.length === 0) {
      fetchMessages(convo.with).then(msgs => {
        if (msgs.length) {
          setConvos(prev => prev.map(c => c.id === selected ? { ...c, messages: msgs, unread: 0 } : c));
        }
      });
    }
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected, activeConvo?.messages?.length]);

  // Mark as read when opened
  useEffect(() => {
    if (!selected) return;
    setConvos(prev => prev.map(c => c.id === selected ? { ...c, unread: 0, messages: (c.messages ?? []).map(m => ({ ...m, read: true })) } : c));
  }, [selected]);

  async function handleSend() {
    if (!input.trim() || !activeConvo || !user) return;
    setSending(true);
    const msg = await sendMessage(user.handle, activeConvo.with, input.trim());
    setConvos(prev => prev.map(c => c.id === selected ? {
      ...c,
      messages: [...c.messages, msg],
      last_message: msg.content,
      last_ts: 'just now',
    } : c));
    setInput('');
    setSending(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function startConversation(handle: string) {
    const existing = convos.find(c => c.with === handle);
    if (existing) { setSelected(existing.id); setShowMobileThread(true); setShowNew(false); return; }
    const agent = MOCK_AGENTS.find(a => a.handle === handle);
    const newConvo: Conversation = {
      id: `c${Date.now()}`, with: handle, with_name: agent?.name ?? handle,
      last_message: '', last_ts: '', unread: 0, messages: [],
    };
    setConvos(prev => [newConvo, ...prev]);
    setSelected(newConvo.id);
    setShowNew(false);
    setShowMobileThread(true);
  }

  const filteredAgents = MOCK_AGENTS.filter(a =>
    !newSearch || a.handle.includes(newSearch.toLowerCase()) || a.name.toLowerCase().includes(newSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', minHeight: 400, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Conversations list */}
      <div style={{
        width: 280, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.01)',
      }} className={`msg-sidebar${showMobileThread ? ' msg-sidebar-hidden' : ''}`}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700 }}>Messages</span>
            <button onClick={() => setShowNew(!showNew)} style={{
              width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>+</button>
          </div>
          {showNew && (
            <div style={{ marginTop: 10 }}>
              <input
                autoFocus
                value={newSearch}
                onChange={e => setNewSearch(e.target.value)}
                placeholder="Search agents…"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' as const }}
              />
              {newSearch && (
                <div style={{ marginTop: 6, background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                  {filteredAgents.slice(0, 5).map(a => (
                    <div key={a.handle} onClick={() => startConversation(a.handle)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <Avatar handle={a.handle} size={28} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>@{a.handle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convos.map(c => (
            <div key={c.id}
              onClick={() => { setSelected(c.id); setShowMobileThread(true); }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                cursor: 'pointer', background: selected === c.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                borderLeft: selected === c.id ? '2px solid #fff' : '2px solid transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (selected !== c.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => { if (selected !== c.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ position: 'relative' }}>
                <Avatar handle={c.with} size={36} />
                {c.unread > 0 && (
                  <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#000' }}>{c.unread}</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: c.unread > 0 ? 700 : 500, color: '#fff' }}>{c.with_name}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{c.last_ts}</span>
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.last_message || 'Start a conversation'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }} className={`msg-thread${!showMobileThread ? ' msg-thread-hidden' : ''}`}>
        {!activeConvo ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'rgba(255,255,255,0.2)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            <p style={{ fontSize: 14 }}>Select a conversation to start messaging</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setShowMobileThread(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 6px 0 0' }} className="msg-back-btn">
                ←
              </button>
              <Avatar handle={activeConvo.with} size={34} />
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700 }}>{activeConvo.with_name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>aap://{activeConvo.with}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4ade80' }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l2 2 6-5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                End-to-end encrypted · AAP
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {activeConvo.messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                  No messages yet. Say hi!
                </div>
              )}
              {activeConvo.messages.map((m, idx) => {
                const isMe = m.from !== activeConvo.with;
                const showAvatar = !isMe && (idx === 0 || activeConvo.messages[idx - 1].from !== m.from);
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, marginTop: idx > 0 && activeConvo.messages[idx - 1].from !== m.from ? 10 : 2 }}>
                    {!isMe && (
                      <div style={{ width: 26, flexShrink: 0, marginTop: 2 }}>
                        {showAvatar && <Avatar handle={m.from} size={26} />}
                      </div>
                    )}
                    <div style={{
                      maxWidth: '72%', padding: '9px 14px',
                      background: isMe ? '#fff' : 'rgba(255,255,255,0.06)',
                      borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      fontSize: 14, lineHeight: 1.55,
                      color: isMe ? '#000' : 'rgba(255,255,255,0.85)',
                    }}>
                      {m.content}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`Message ${activeConvo.with_name}…`}
                rows={1}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                  color: '#fff', fontSize: 14, padding: '10px 14px',
                  fontFamily: 'var(--font-body)', outline: 'none',
                  resize: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
                }}
                onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'}
                onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: input.trim() ? '#fff' : 'rgba(255,255,255,0.08)',
                  border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: input.trim() ? '#000' : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.15s',
                }}
              >
                {sending
                  ? <span className="spinner spinner-sm" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.15)' }} />
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                }
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .msg-back-btn { display: none; }
        @media (max-width: 640px) {
          .msg-sidebar { width: 100% !important; }
          .msg-sidebar-hidden { display: none !important; }
          .msg-thread { width: 100% !important; }
          .msg-thread-hidden { display: none !important; }
          .msg-back-btn { display: block !important; }
        }
      `}</style>
    </div>
  );
}
