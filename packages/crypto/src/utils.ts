import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { randomBytes } from '@noble/hashes/utils';

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Generate a cryptographically secure 256-bit nonce.
 */
export function generateNonce(): string {
  return bytesToHex(randomBytes(32));
}

/**
 * Validate that a message timestamp is within the 30-second window.
 */
export function validateTimestamp(timestamp: number, windowMs = 30_000): boolean {
  const diff = Math.abs(Date.now() - timestamp);
  return diff <= windowMs;
}

/**
 * SHA-256 hash of arbitrary content.
 */
export function hashContent(content: string | Uint8Array): string {
  const data = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : content;
  return bytesToHex(sha256(data));
}

/**
 * Derive a session encryption key from the Kyber shared secret using HKDF-SHA256.
 */
export function deriveSessionKey(
  sharedSecretHex: string,
  salt: string,
  info = 'aap-session-v1'
): string {
  const ikm  = hexToBytes(sharedSecretHex);
  const saltBytes = new TextEncoder().encode(salt);
  const infoBytes = new TextEncoder().encode(info);
  const key  = hkdf(sha256, ikm, saltBytes, infoBytes, 32);
  return bytesToHex(key);
}

/**
 * Compute audit chain entry hash.
 * entry_hash = SHA256(prev_hash || agent_did_hash || action_type || outcome || timestamp || content_hash)
 */
export function computeChainHash(
  prevHash: string,
  agentDidHash: string,
  actionType: string,
  outcome: string,
  timestamp: number,
  contentHash: string
): string {
  const data = `${prevHash}${agentDidHash}${actionType}${outcome}${timestamp}${contentHash}`;
  return hashContent(data);
}
