import { v4 as uuidv4 } from 'uuid';
import { OuterEnvelope, MiddleEnvelope, InnerEnvelope } from './types';
import { generateNonce, hashContent, bytesToHex, hexToBytes } from './utils';
import { sign, verify } from './ed25519';

const AAP_VERSION = '1.0';
const MESSAGE_TTL = 30;

/**
 * Build the outer envelope (visible to routing infrastructure).
 * Signs the entire outer envelope with the sender's private key.
 */
export function buildOuterEnvelope(
  fromDid: string,
  toDid: string,
  encryptedMiddle: string,
  privateKeyHex: string
): OuterEnvelope {
  const partial: Omit<OuterEnvelope, 'outer_signature'> = {
    aap_version:               AAP_VERSION,
    from_did:                  fromDid,
    to_did:                    toDid,
    message_id:                uuidv4(),
    timestamp:                 Date.now(),
    nonce:                     generateNonce(),
    ttl:                       MESSAGE_TTL,
    middle_envelope_encrypted: encryptedMiddle,
  };

  const signatureInput = new TextEncoder().encode(JSON.stringify(partial));
  const outer_signature = sign(signatureInput, privateKeyHex);

  return { ...partial, outer_signature };
}

/**
 * Build the middle envelope (encrypted with receiver's public key).
 * Contains action type and capability token.
 */
export function buildMiddleEnvelope(
  actionType: string,
  capabilityToken: string,
  encryptedInner: string,
  privateKeyHex: string
): MiddleEnvelope {
  const partial = {
    action_type:              actionType,
    capability_token:         capabilityToken,
    schema_version:           '1.0',
    inner_envelope_encrypted: encryptedInner,
  };

  const signatureInput = new TextEncoder().encode(JSON.stringify(partial));
  const middle_signature = sign(signatureInput, privateKeyHex);

  return { ...partial, middle_signature };
}

/**
 * Build the inner envelope (encrypted with session key).
 * Contains the actual typed parameters.
 */
export function buildInnerEnvelope(parameters: Record<string, unknown>): InnerEnvelope {
  return { parameters };
}

/**
 * Verify and parse an outer envelope.
 * Returns null if signature is invalid or timestamp is outside window.
 */
export function parseEnvelope(
  envelope: OuterEnvelope,
  senderPublicKeyHex: string
): { valid: boolean; reason?: string } {
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

  return { valid: true };
}
