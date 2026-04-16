/**
 * AAP API client — thin wrappers around the backend services.
 * All calls proxy through Vite dev server to avoid CORS issues.
 */

export interface AgentIdentity {
  did: string;
  aap_address: string;
  public_key_hex: string;
  private_key_hex: string;
  registered_at: string;
  signature_algorithm: 'ed25519' | 'dilithium3';
}

export interface TrustInfo {
  did: string;
  trust_score: number;
  verification_level: string;
  breakdown: { base: number; verification: number; age_days: number; interactions: number };
}

export interface AuditEntry {
  id: number;
  entry_hash: string;
  prev_hash: string;
  agent_did_hash: string;
  action_type: string;
  outcome: string;
  timestamp: number;
  content_hash: string;
}

export interface ApprovalRequest {
  id: string;
  agent_did: string;
  action_type: string;
  category: number;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  created_at: number;
  expires_at: number;
}

// ─── Identity (stored in localStorage) ───────────────────────────────────────

const IDENTITY_KEY = 'aap:identity';

export function loadIdentity(): AgentIdentity | null {
  const raw = localStorage.getItem(IDENTITY_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveIdentity(id: AgentIdentity) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
}

export function clearIdentity() {
  localStorage.removeItem(IDENTITY_KEY);
}

// ─── Key generation (browser-native Web Crypto) ──────────────────────────────

export async function generateKeyPair(): Promise<{ publicKeyHex: string; privateKeyHex: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const pubRaw  = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const toHex   = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  return { publicKeyHex: toHex(pubRaw), privateKeyHex: toHex(privRaw) };
}

async function signPayload(body: object, privateKeyHex: string): Promise<string> {
  // Import the private key
  const keyBytes = Uint8Array.from(privateKeyHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey(
    'pkcs8', keyBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const msgBytes = new TextEncoder().encode(JSON.stringify(body));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, msgBytes);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function generateNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export async function registerAgent(name: string): Promise<AgentIdentity> {
  const kp          = await generateKeyPair();
  const aap_address = `aap://${name}`;
  const timestamp   = Date.now();
  const nonce       = generateNonce();

  const bodyToSign = {
    aap_address,
    public_key_hex:  kp.publicKeyHex,
    endpoint_url:    `https://agent.${name.replace(/\./g, '-')}.local`,
    capabilities:    [],
    owner_type:      'human',
    timestamp,
    nonce,
  };

  const signature = await signPayload(bodyToSign, kp.privateKeyHex);

  const res = await fetch('/api/registry/v1/register', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...bodyToSign, signature }),
  });

  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error);
  }

  const data = await res.json() as { did: string; aap_address: string };
  const identity: AgentIdentity = {
    did:                 data.did,
    aap_address:         data.aap_address,
    public_key_hex:      kp.publicKeyHex,
    private_key_hex:     kp.privateKeyHex,
    registered_at:       new Date().toISOString(),
    signature_algorithm: 'ed25519',
  };
  saveIdentity(identity);
  return identity;
}

export async function lookupAgent(address: string) {
  const encoded = encodeURIComponent(address);
  const res = await fetch(`/api/registry/v1/lookup/${encoded}`);
  if (!res.ok) throw new Error(`Agent not found: ${address}`);
  return res.json();
}

export async function getTrustScore(did: string): Promise<TrustInfo> {
  const res = await fetch(`/api/registry/v1/agent/${encodeURIComponent(did)}/trust`);
  if (!res.ok) throw new Error('Could not fetch trust score');
  return res.json();
}

// ─── Mailbox ──────────────────────────────────────────────────────────────────

export async function sendMessage(payload: {
  to_address: string;
  from_did: string;
  action_type: string;
  content: Record<string, unknown>;
}) {
  const res = await fetch('/api/mailbox/v1/messages/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function getInbox(did: string): Promise<{ messages: unknown[] }> {
  const res = await fetch(`/api/mailbox/v1/messages/inbox?did=${encodeURIComponent(did)}`);
  if (!res.ok) return { messages: [] };
  return res.json();
}

// ─── Audit chain ─────────────────────────────────────────────────────────────

export async function getAuditChain(limit = 50, offset = 0): Promise<{ entries: AuditEntry[] }> {
  const res = await fetch(`/api/audit/v1/audit/chain?limit=${limit}&offset=${offset}`);
  if (!res.ok) return { entries: [] };
  return res.json();
}

export async function verifyChain(): Promise<{ valid: boolean; length: number; broken_at?: number }> {
  const res = await fetch('/api/audit/v1/audit/verify');
  if (!res.ok) return { valid: false, length: 0 };
  return res.json();
}

// ─── Human Auth ───────────────────────────────────────────────────────────────

export async function getPendingApprovals(): Promise<{ requests: ApprovalRequest[] }> {
  const res = await fetch('/api/auth/v1/auth/pending');
  if (!res.ok) return { requests: [] };
  return res.json();
}

export async function approveRequest(id: string, approved: boolean) {
  const res = await fetch(`/api/auth/v1/auth/requests/${id}/${approved ? 'approve' : 'deny'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator_id: 'web-dashboard' }),
  });
  if (!res.ok) throw new Error('Failed to update approval');
  return res.json();
}
