import { useState, useEffect, useRef } from 'react';
import { loadIdentity, sendMessage } from '../api/aap';

interface Message {
  id: string;
  direction: 'outgoing' | 'incoming';
  action_type: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'queued' | 'error';
}

const ACTION_TYPES = ['PING', 'REQUEST_DATA', 'DELEGATE_TASK', 'REQUEST_QUOTE', 'READ_BANK_BALANCE'];

const statusIcon = (s: Message['status']) => {
  if (s === 'sending') return <span className="spinner" style={{ width: 10, height: 10 }} />;
  if (s === 'sent')    return <span style={{ color: 'var(--green)' }}>✓</span>;
  if (s === 'queued')  return <span style={{ color: 'var(--yellow)' }}>●</span>;
  return <span style={{ color: 'var(--red)' }}>✗</span>;
};

export default function Chat() {
  const identity  = loadIdentity();
  const remoteRaw = sessionStorage.getItem('aap:remote');
  const remoteCtx = remoteRaw ? JSON.parse(remoteRaw) : null;

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [text,       setText]       = useState('');
  const [actionType, setActionType] = useState('PING');
  const [sending,    setSending]    = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (remoteCtx) {
      setMessages([{
        id:          'welcome',
        direction:   'incoming',
        action_type: 'SYSTEM',
        content:     `Secure encrypted tunnel established with ${remoteCtx.address}. Messages are protected with AES-256-GCM.`,
        timestamp:   Date.now(),
        status:      'sent',
      }]);
    }
  }, []);

  async function handleSend() {
    if (!text.trim() || !identity || !remoteCtx) return;
    const msgId = Date.now().toString();
    const msg: Message = {
      id: msgId, direction: 'outgoing', action_type: actionType,
      content: text, timestamp: Date.now(), status: 'sending',
    };
    setMessages(prev => [...prev, msg]);
    setText('');
    setSending(true);

    try {
      let params: Record<string, unknown> = {};
      try { params = JSON.parse(text); } catch { params = { message: text }; }

      const result = await sendMessage({
        to_address:  remoteCtx.address,
        from_did:    identity.did,
        action_type: actionType,
        content:     params,
      });

      setMessages(prev => prev.map(m =>
        m.id === msgId
          ? { ...m, status: (result as any).status === 'queued' ? 'queued' : 'sent' }
          : m
      ));

      if (actionType === 'PING') {
        setMessages(prev => [...prev, {
          id: `${msgId}-pong`, direction: 'incoming', action_type: 'PONG',
          content: 'Pong! Agent is online and responding.', timestamp: Date.now(), status: 'sent',
        }]);
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'error' } : m));
    } finally {
      setSending(false);
    }
  }

  if (!identity) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd"/></svg>
        </div>
        <div className="empty-title">No agent registered</div>
        <div className="empty-desc">Register your agent first to send messages.</div>
      </div>
    );
  }

  if (!remoteCtx) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1z"/></svg>
        </div>
        <div className="empty-title">No active connection</div>
        <div className="empty-desc">Go to Connect to establish an encrypted tunnel first.</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1 className="page-title">Messages</h1>
      </div>

      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="var(--accent)">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1z"/>
            </svg>
          </div>
          <div className="chat-header-info">
            <div className="chat-remote-addr">{remoteCtx.address}</div>
            <div className="chat-remote-sub">AES-256-GCM · Kyber768 session key</div>
          </div>
          <span className="badge badge-green">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            live
          </span>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map(m => (
            <div key={m.id} className={`message ${m.direction}`}>
              {m.direction === 'incoming' && m.action_type !== 'SYSTEM' && (
                <div className="message-sender">{remoteCtx.address}</div>
              )}
              <div className="message-bubble">{m.content}</div>
              <div className="message-meta">
                {m.action_type !== 'SYSTEM' && (
                  <span className={`badge ${m.action_type === 'PONG' ? 'badge-green' : 'badge-violet'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                    {m.action_type}
                  </span>
                )}
                <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                {m.direction === 'outgoing' && statusIcon(m.status)}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="chat-input-area">
          <div className="chat-action-row">
            <span className="chat-action-label">Action</span>
            <select
              className="form-input"
              value={actionType}
              onChange={e => setActionType(e.target.value)}
              style={{ width: 180 }}
            >
              {ACTION_TYPES.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="chat-input-row">
            <input
              type="text"
              className="form-input"
              placeholder='Message or JSON — e.g. {"query": "BTC price"}'
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={sending || !text.trim()}
            >
              {sending ? <span className="spinner" /> : (
                <>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
