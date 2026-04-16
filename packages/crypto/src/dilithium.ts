import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { KeyPair } from './types';
import { bytesToHex, hexToBytes, generateNonce } from './utils';

/**
 * CRYSTALS-Dilithium3 (ML-DSA-65) — NIST PQC standard post-quantum signatures.
 * Safe against quantum computer attacks through 2070+.
 */
export function dilithium3KeyPair(): KeyPair {
  const seed       = hexToBytes(generateNonce()); // 32 random bytes
  const { secretKey, publicKey } = ml_dsa65.keygen(seed);
  return {
    privateKey:    secretKey,
    publicKey:     publicKey,
    privateKeyHex: bytesToHex(secretKey),
    publicKeyHex:  bytesToHex(publicKey),
    algorithm:     'dilithium3',
  };
}

/**
 * Sign with Dilithium3 (ML-DSA-65).
 */
export function dilithium3Sign(message: Uint8Array, privateKeyHex: string): string {
  const secretKey = hexToBytes(privateKeyHex);
  const signature = ml_dsa65.sign(secretKey, message);
  return bytesToHex(signature);
}

/**
 * Verify a Dilithium3 signature.
 */
export function dilithium3Verify(
  message: Uint8Array,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  try {
    const signature = hexToBytes(signatureHex);
    const publicKey = hexToBytes(publicKeyHex);
    return ml_dsa65.verify(publicKey, message, signature);
  } catch {
    return false;
  }
}
