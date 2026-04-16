import { generateKeyPair, sign, verify } from '../src/ed25519';
import { dilithium3KeyPair, dilithium3Sign, dilithium3Verify } from '../src/dilithium';
import { kyberKeyPair, kyberEncapsulate, kyberDecapsulate } from '../src/kyber';
import { generateNonce, validateTimestamp, hashContent, deriveSessionKey, computeChainHash } from '../src/utils';
import { buildOuterEnvelope, parseEnvelope } from '../src/envelope';

// ─── Ed25519 ───────────────────────────────────────────────────────────────

describe('Ed25519', () => {
  it('generates a key pair', () => {
    const kp = generateKeyPair();
    expect(kp.publicKeyHex).toHaveLength(64);
    expect(kp.privateKeyHex).toHaveLength(64);
    expect(kp.algorithm).toBe('ed25519');
  });

  it('signs and verifies a message', () => {
    const kp  = generateKeyPair();
    const msg = new TextEncoder().encode('hello aap');
    const sig = sign(msg, kp.privateKeyHex);
    expect(verify(msg, sig, kp.publicKeyHex)).toBe(true);
  });

  it('rejects a tampered message', () => {
    const kp       = generateKeyPair();
    const msg      = new TextEncoder().encode('hello aap');
    const tampered = new TextEncoder().encode('tampered!');
    const sig      = sign(msg, kp.privateKeyHex);
    expect(verify(tampered, sig, kp.publicKeyHex)).toBe(false);
  });

  it('rejects a wrong public key', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const msg = new TextEncoder().encode('hello aap');
    const sig = sign(msg, kp1.privateKeyHex);
    expect(verify(msg, sig, kp2.publicKeyHex)).toBe(false);
  });
});

// ─── Dilithium3 ───────────────────────────────────────────────────────────

describe('Dilithium3', () => {
  it('generates a key pair', () => {
    const kp = dilithium3KeyPair();
    expect(kp.publicKeyHex.length).toBeGreaterThan(0);
    expect(kp.algorithm).toBe('dilithium3');
  });

  it('signs and verifies a message', () => {
    const kp  = dilithium3KeyPair();
    const msg = new TextEncoder().encode('aap post-quantum test');
    const sig = dilithium3Sign(msg, kp.privateKeyHex);
    expect(dilithium3Verify(msg, sig, kp.publicKeyHex)).toBe(true);
  });

  it('rejects a tampered message', () => {
    const kp       = dilithium3KeyPair();
    const msg      = new TextEncoder().encode('original');
    const tampered = new TextEncoder().encode('tampered');
    const sig      = dilithium3Sign(msg, kp.privateKeyHex);
    expect(dilithium3Verify(tampered, sig, kp.publicKeyHex)).toBe(false);
  });
});

// ─── Kyber768 ─────────────────────────────────────────────────────────────

describe('Kyber768', () => {
  it('generates a key pair', () => {
    const kp = kyberKeyPair();
    expect(kp.publicKeyHex.length).toBeGreaterThan(0);
    expect(kp.privateKeyHex.length).toBeGreaterThan(0);
  });

  it('encapsulate + decapsulate produce the same shared secret', () => {
    const kp         = kyberKeyPair();
    const { ciphertextHex, sharedSecretHex: encShared } = kyberEncapsulate(kp.publicKeyHex);
    const { sharedSecretHex: decShared } = kyberDecapsulate(ciphertextHex, kp.privateKeyHex);
    expect(encShared).toBe(decShared);
  });
});

// ─── Utils ────────────────────────────────────────────────────────────────

describe('Utils', () => {
  it('generateNonce returns 64-char hex string', () => {
    const n = generateNonce();
    expect(n).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(n)).toBe(true);
  });

  it('generates unique nonces', () => {
    const nonces = new Set(Array.from({ length: 100 }, generateNonce));
    expect(nonces.size).toBe(100);
  });

  it('validateTimestamp accepts recent timestamps', () => {
    expect(validateTimestamp(Date.now())).toBe(true);
    expect(validateTimestamp(Date.now() - 15_000)).toBe(true);
  });

  it('validateTimestamp rejects stale timestamps', () => {
    expect(validateTimestamp(Date.now() - 31_000)).toBe(false);
    expect(validateTimestamp(Date.now() + 31_000)).toBe(false);
  });

  it('hashContent produces consistent SHA-256', () => {
    const h1 = hashContent('hello');
    const h2 = hashContent('hello');
    const h3 = hashContent('world');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toHaveLength(64);
  });

  it('deriveSessionKey produces 64-char hex', () => {
    const secret = generateNonce();
    const key    = deriveSessionKey(secret, 'salt-abc');
    expect(key).toHaveLength(64);
  });

  it('computeChainHash is deterministic', () => {
    const h1 = computeChainHash('prev', 'agent', 'PING', 'success', 123, 'content');
    const h2 = computeChainHash('prev', 'agent', 'PING', 'success', 123, 'content');
    expect(h1).toBe(h2);
  });
});

// ─── Envelope ─────────────────────────────────────────────────────────────

describe('Envelope', () => {
  it('builds and verifies a valid outer envelope', () => {
    const kp       = generateKeyPair();
    const envelope = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'encrypted_middle', kp.privateKeyHex);

    expect(envelope.from_did).toBe('did:aap:alice');
    expect(envelope.to_did).toBe('did:aap:bob');
    expect(envelope.outer_signature).toBeTruthy();

    const result = parseEnvelope(envelope, kp.publicKeyHex);
    expect(result.valid).toBe(true);
  });

  it('rejects envelope with wrong public key', () => {
    const kp1      = generateKeyPair();
    const kp2      = generateKeyPair();
    const envelope = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'encrypted_middle', kp1.privateKeyHex);
    const result   = parseEnvelope(envelope, kp2.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('rejects envelope with expired timestamp', () => {
    const kp       = generateKeyPair();
    const envelope = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'encrypted_middle', kp.privateKeyHex);
    envelope.timestamp = Date.now() - 60_000; // 60 seconds ago
    const result   = parseEnvelope(envelope, kp.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('TIMESTAMP_EXPIRED');
  });
});
