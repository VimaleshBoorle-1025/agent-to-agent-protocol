import { ed25519 } from '@noble/curves/ed25519';
import { KeyPair } from './types';
import { bytesToHex, hexToBytes } from './utils';

/**
 * Generate an Ed25519 key pair.
 * Used as the v1.0 fallback when Dilithium3 native bindings are unavailable.
 */
export function generateKeyPair(): KeyPair {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey  = ed25519.getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex:  bytesToHex(publicKey),
    algorithm: 'ed25519',
  };
}

export interface AAPKeyPair extends KeyPair {}

/**
 * Sign arbitrary bytes with an Ed25519 private key.
 */
export function sign(message: Uint8Array, privateKeyHex: string): string {
  const privateKey = hexToBytes(privateKeyHex);
  const signature  = ed25519.sign(message, privateKey);
  return bytesToHex(signature);
}

/**
 * Verify an Ed25519 signature.
 */
export function verify(
  message: Uint8Array,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  try {
    const signature = hexToBytes(signatureHex);
    const publicKey = hexToBytes(publicKeyHex);
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}
