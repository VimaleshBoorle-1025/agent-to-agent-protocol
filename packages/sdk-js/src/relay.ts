/**
 * RelayTransport — connect two agents in real-time via the AAP session relay.
 *
 * Works in Node.js (ws package) and browsers (native WebSocket).
 * Either side can initiate — the first to connect becomes host,
 * the second becomes guest. Once both are connected, frames flow
 * bidirectionally through the relay without server decryption.
 *
 * Usage:
 *   const relay = new RelayTransport(mailboxUrl, handle, did);
 *   await relay.connect();
 *   relay.onReceive(frame => console.log('got', frame));
 *   relay.send(outerEnvelopeBytes);
 */

export type RelayFrame = string | Buffer | ArrayBuffer | Uint8Array;

export type RelayEvent =
  | { type: 'SESSION_WAITING'; handle: string; role: 'host' }
  | { type: 'SESSION_READY';   handle: string; peers: number }
  | { type: 'SESSION_CLOSED';  by: string }
  | { type: 'ERROR';           error: string };

export class RelayTransport {
  private ws?: any;
  private _ready   = false;
  private _queue: RelayFrame[] = [];
  private _onMessage?: (frame: RelayFrame) => void;
  private _onEvent?:   (event: RelayEvent)  => void;
  private _resolveReady?: () => void;
  private _rejectReady?:  (err: Error) => void;

  constructor(
    private readonly mailboxUrl: string,
    private readonly handle:     string,
    private readonly did:        string,
    /** Optional Ed25519 signature of the DID for verified auth */
    private readonly signature?: string
  ) {}

  /**
   * Establish the relay connection.
   * Resolves when SESSION_WAITING or SESSION_READY is received —
   * i.e. as soon as we are live on the relay, before the peer arrives.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._resolveReady = resolve;
      this._rejectReady  = reject;

      const wsUrl = this.mailboxUrl
        .replace(/^https:\/\//, 'wss://')
        .replace(/^http:\/\//, 'ws://')
        .replace(/\/$/, '');

      const fullUrl = `${wsUrl}/v1/session/${encodeURIComponent(this.handle)}/ws`;
      const auth    = this.signature
        ? `DID ${this.did} ${this.signature}`
        : `DID ${this.did}`;

      // Browser WebSocket (no custom headers — send auth as first message instead)
      const isBrowser = typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined';
      if (isBrowser) {
        this.ws = new WebSocket(fullUrl);
        this._attach(this.ws, auth, true /* sendAuthAsMessage */);
      } else {
        // Node.js — use `ws` if available, else dynamic require
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const WS = require('ws');
          this.ws = new WS(fullUrl, { headers: { Authorization: auth } });
          this._attach(this.ws, auth, false);
        } catch {
          reject(new Error('RelayTransport: install the "ws" package for Node.js usage'));
        }
      }
    });
  }

  private _attach(ws: any, auth: string, sendAuthAsMessage: boolean) {
    ws.onopen = () => {
      if (sendAuthAsMessage) {
        ws.send(JSON.stringify({ type: 'AUTH', authorization: auth }));
      }
    };

    ws.onmessage = (ev: any) => {
      const raw = typeof ev.data === 'string' ? ev.data : ev.data?.toString?.() ?? '';
      try {
        const msg = JSON.parse(raw) as RelayEvent;
        if (msg.type === 'SESSION_WAITING' || msg.type === 'SESSION_READY') {
          this._ready = true;
          this._resolveReady?.();
          // Flush queued frames
          for (const frame of this._queue) {
            try { ws.send(frame); } catch { /* skip */ }
          }
          this._queue = [];
          this._onEvent?.(msg);
          return;
        }
        if (msg.type === 'ERROR') {
          this._rejectReady?.(new Error(`Relay error: ${msg.error}`));
          this._onEvent?.(msg);
          return;
        }
        if (msg.type === 'SESSION_CLOSED') {
          this._ready = false;
          this._onEvent?.(msg);
          return;
        }
      } catch { /* not a control frame — treat as data */ }

      // Data frame — pass to consumer
      this._onMessage?.(ev.data);
    };

    ws.onerror = (err: any) => {
      const e = err instanceof Error ? err : new Error(String(err?.message ?? 'WebSocket error'));
      this._rejectReady?.(e);
    };

    ws.onclose = () => {
      this._ready = false;
    };
  }

  /** Send a frame. Queued automatically if the peer hasn't joined yet. */
  send(frame: RelayFrame): void {
    if (this._ready && this.ws) {
      try { this.ws.send(frame); } catch { this._queue.push(frame); }
    } else {
      this._queue.push(frame);
    }
  }

  /** Register a handler for incoming data frames from the peer. */
  onReceive(handler: (frame: RelayFrame) => void): void {
    this._onMessage = handler;
  }

  /** Register a handler for relay control events (READY, CLOSED, ERROR). */
  onEvent(handler: (event: RelayEvent) => void): void {
    this._onEvent = handler;
  }

  close(): void {
    try { this.ws?.close(1000, 'done'); } catch { /* already closed */ }
    this._ready = false;
  }

  get isReady(): boolean { return this._ready; }
}
