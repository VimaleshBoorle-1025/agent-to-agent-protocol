import { v4 as uuidv4 } from 'uuid';
import { OuterEnvelope, MiddleEnvelope, InnerEnvelope } from './types';
import { generateNonce, hashContent, bytesToHex, hexToBytes, encryptAES, decryptAES } from './utils';
import { sign, verify } from './ed25519';

const AAP_VERSION = '1.0';
const MESSAGE_TTL = 30;

/**
 * Build the outer envelope (visible to routing infrastructure).
 * middle envelope is AES-256-GCM encrypted with sessionKey when provided.
 * Outer envelope is signed with sender's Ed25519 private key.
 */
export function buildOuterEnvelope(
  fromDid: string,
  toDid: string,
  encryptedMiddle: string,
  privateKeyHex: string,
  sessionKey?: string
): OuterEnvelope {
  const middle = sessionKey ? encryptAES(encryptedMiddle, sessionKey) : encryptedMiddle;

  const partial: Omit<OuterEnvelope, 'outer_signature'> = {
    aap_version:               AAP_VERSION,
    from_did:                  fromDid,
    to_did:                    toDid,
    message_id:                uuidv4(),
    timestamp:                 Date.now(),
    nonce:                     generateNonce(),
    ttl:                       MESSAGE_TTL,
    middle_envelope_encrypted: middle,
  };

  const signatureInput = new TextEncoder().encode(JSON.stringify(partial));
  const outer_signature = sign(signatureInput, privateKeyHex);

  return { ...partial, outer_signature };
}

/**
 * Build the middle envelope (encrypted with session key when provided).
 * Contains action type and capability token.
 */
export function buildMiddleEnvelope(
  actionType: string,
  capabilityToken: string,
  encryptedInner: string,
  privateKeyHex: string,
  sessionKey?: string
): MiddleEnvelope {
  const inner = sessionKey ? encryptAES(encryptedInner, sessionKey) : encryptedInner;

  const partial = {
    action_type:              actionType,
    capability_token:         capabilityToken,
    schema_version:           '1.0',
    inner_envelope_encrypted: inner,
  };

  const signatureInput = new TextEncoder().encode(JSON.stringify(partial));
  const middle_signature = sign(signatureInput, privateKeyHex);

  return { ...partial, middle_signature };
}

/**
 * Build the inner envelope (contains actual typed parameters).
 * Serialized as JSON before being passed to buildMiddleEnvelope for encryption.
 */
export function buildInnerEnvelope(parameters: Record<string, unknown>): InnerEnvelope {
  return { parameters };
}

/**
 * Verify and parse an outer envelope.
 * If sessionKey provided, decrypts the middle envelope after signature check.
 * Returns null if signature is invalid or timestamp is outside window.
 */
export function parseEnvelope(
  envelope: OuterEnvelope,
  senderPublicKeyHex: string,
  sessionKey?: string
): { valid: boolean; reason?: string; decryptedMiddle?: string } {
  // Verify timestamp
  const diff = Math.abs(Date.now() - envelope.timestamp);
  if (diff > 30_000) {
    return { valid: false, reason: 'TIMESTAMP_EXPIRED' };
  }

  // Verify signature
  const { outer_signature, ...rest } = envelope;
  const signatureInput = new TextEncoder().encode(JSON.stringify(rest));
  const isValid = verify(signatureInput, outer_signature, senderPublicKeyHex);
  if (!isValid) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  // Optionally decrypt middle envelope
  if (sessionKey) {
    try {
      const decryptedMiddle = decryptAES(envelope.middle_envelope_encrypted, sessionKey);
      return { valid: true, decryptedMiddle };
    } catch {
      return { valid: false, reason: 'DECRYPTION_FAILED' };
    }
  }

  return { valid: true };
}
