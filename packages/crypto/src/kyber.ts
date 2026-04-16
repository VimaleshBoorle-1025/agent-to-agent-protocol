import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { bytesToHex, hexToBytes, generateNonce } from './utils';

export interface KyberKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  publicKeyHex: string;
  privateKeyHex: string;
}

export interface KyberEncapsulation {
  ciphertext: Uint8Array;
  ciphertextHex: string;
  sharedSecret: Uint8Array;
  sharedSecretHex: string;
}

/**
 * CRYSTALS-Kyber768 (ML-KEM-768) — NIST PQC standard post-quantum Key Encapsulation.
 * Used to establish a shared session secret during AAP handshake.
 */
export function kyberKeyPair(): KyberKeyPair {
  const seed = hexToBytes(generateNonce() + generateNonce()); // 64 bytes seed
  const { secretKey, publicKey } = ml_kem768.keygen(seed);
  return {
    publicKey,
    privateKey:    secretKey,
    publicKeyHex:  bytesToHex(publicKey),
    privateKeyHex: bytesToHex(secretKey),
  };
}

/**
 * Encapsulate: generate a shared secret and ciphertext using recipient's public key.
 * Called by Agent A during HANDSHAKE_INIT.
 */
export function kyberEncapsulate(recipientPublicKeyHex: string): KyberEncapsulation {
  const publicKey = hexToBytes(recipientPublicKeyHex);
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
  return {
    ciphertext:      cipherText,
    ciphertextHex:   bytesToHex(cipherText),
    sharedSecret,
    sharedSecretHex: bytesToHex(sharedSecret),
  };
}

/**
 * Decapsulate: recover the shared secret from ciphertext using private key.
 * Called by Agent B after receiving HANDSHAKE_INIT.
 */
export function kyberDecapsulate(
  ciphertextHex: string,
  privateKeyHex: string
): { sharedSecret: Uint8Array; sharedSecretHex: string } {
  const ciphertext = hexToBytes(ciphertextHex);
  const secretKey  = hexToBytes(privateKeyHex);
  const sharedSecret = ml_kem768.decapsulate(ciphertext, secretKey);
  return { sharedSecret, sharedSecretHex: bytesToHex(sharedSecret) };
}
