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

export default function Chat() {
  const identity  = loadIdentity();
  const remoteRaw = sessionStorage.getItem('aap:remote');
  const remoteCtx = remoteRaw ? JSON.parse(remoteRaw) : null;

  const [messages,    setMessages]    = useState<Message[]>([]);
  const [text,        setText]        = useState('');
  const [actionType,  setActionType]  = useState('PING');
  const [sending,     setSending]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add a welcome message if connected
  useEffect(() => {
    if (remoteCtx) {
      setMessages([{
        id:          'welcome',
        direction:   'incoming',
        action_type: 'SYSTEM',
        content:     `Secure tunnel established with ${remoteCtx.address}`,
        timestamp:   Date.now(),
        status:      'sent',
      }]);
    }
  }, []);

  async function handleSend() {
    if (!text.trim() || !identity || !remoteCtx) return;
    const msgId = Date.now().toString();
    const msg: Message = {
      id:          msgId,
      direction:   'outgoing',
      action_type: actionType,
      content:     text,
      timestamp:   Date.now(),
      status:      'sending',
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

      // Add response if action_type is PING
      if (actionType === 'PING') {
        setMessages(prev => [...prev, {
          id:          `${msgId}-pong`,
          direction:   'incoming',
          action_type: 'PONG',
          content:     'Pong! Agent is online.',
          timestamp:   Date.now(),
          status:      'sent',
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
        <div className="empty-icon">🔑</div>
        <div>Register your agent first to use chat.</div>
      </div>
    );
  }

  if (!remoteCtx) {
    return (
      <div className="empty">
        <div className="empty-icon">🔗</div>
        <div>No active connection. Go to Connect to establish a tunnel.</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Chat</h1>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Connected to <span style={{ color: 'var(--accent)' }}>{remoteCtx.address}</span>
          <span className="badge badge-green" style={{ marginLeft: 8 }}>● live</span>
        </div>
      </div>

      <div className="card chat-window" style={{ padding: 0 }}>
        <div className="chat-messages">
          {messages.map(m => (
            <div key={m.id} className={`message ${m.direction}`}>
              {m.direction === 'incoming' && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                  {remoteCtx.address} · {m.action_type}
                </div>
              )}
              <div className="message-bubble">{m.content}</div>
              <div className="message-meta">
                {m.action_type !== 'SYSTEM' && (
                  <>
                    <span className={`badge ${m.action_type === 'PONG' ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: 10 }}>
                      {m.action_type}
                    </span>
                    {' '}
                  </>
                )}
                {new Date(m.timestamp).toLocaleTimeString()}
                {m.direction === 'outgoing' && (
                  <span style={{ marginLeft: 6, color: m.status === 'error' ? 'var(--red)' : m.status === 'queued' ? 'var(--yellow)' : 'var(--green)' }}>
                    {m.status === 'sending' ? '⏳' : m.status === 'sent' ? '✓' : m.status === 'queued' ? '📬' : '✗'}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <select value={actionType} onChange={e => setActionType(e.target.value)} style={{ width: 160 }}>
            {ACTION_TYPES.map(a => <option key={a}>{a}</option>)}
          </select>
          <input
            type="text"
            placeholder='Message or JSON params e.g. {"query":"BTC price"}'
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || !text.trim()}>
            {sending ? <span className="spinner" /> : 'Send'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
        Messages are encrypted with AES-256-GCM · Session key derived via Kyber768 + HKDF-SHA256
      </div>
    </>
  );
}
