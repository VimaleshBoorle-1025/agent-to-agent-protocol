/**
 * Tests for three-envelope round-trip: build → verify.
 * Covers buildOuterEnvelope, buildMiddleEnvelope, buildInnerEnvelope, parseEnvelope.
 */

import { generateKeyPair } from '../../crypto/src/ed25519';
import {
  buildOuterEnvelope,
  buildMiddleEnvelope,
  buildInnerEnvelope,
  parseEnvelope,
} from '../../crypto/src/envelope';

// ─── Inner Envelope ────────────────────────────────────────────────────────

describe('buildInnerEnvelope()', () => {
  it('wraps parameters unchanged', () => {
    const params = { amount: 100, currency: 'USD', from_did: 'did:aap:alice' };
    const inner = buildInnerEnvelope(params);
    expect(inner.parameters).toEqual(params);
  });

  it('handles empty parameters', () => {
    const inner = buildInnerEnvelope({});
    expect(inner.parameters).toEqual({});
  });
});

// ─── Middle Envelope ───────────────────────────────────────────────────────

describe('buildMiddleEnvelope()', () => {
  it('sets correct action_type and capability_token', () => {
    const kp = generateKeyPair();
    const inner = buildInnerEnvelope({ from_did: 'did:aap:alice' });
    const middle = buildMiddleEnvelope('PING', 'cap-token-123', JSON.stringify(inner), kp.privateKeyHex);

    expect(middle.action_type).toBe('PING');
    expect(middle.capability_token).toBe('cap-token-123');
    expect(middle.schema_version).toBe('1.0');
  });

  it('includes a middle_signature', () => {
    const kp = generateKeyPair();
    const inner = buildInnerEnvelope({ from_did: 'did:aap:alice' });
    const middle = buildMiddleEnvelope('PING', 'token', JSON.stringify(inner), kp.privateKeyHex);

    expect(middle.middle_signature).toBeTruthy();
    expect(middle.middle_signature.length).toBeGreaterThan(0);
  });

  it('stores encrypted inner envelope', () => {
    const kp = generateKeyPair();
    const inner = buildInnerEnvelope({ value: 42 });
    const encryptedInner = JSON.stringify(inner);
    const middle = buildMiddleEnvelope('REQUEST_DATA', 'tok', encryptedInner, kp.privateKeyHex);

    expect(middle.inner_envelope_encrypted).toBe(encryptedInner);
  });
});

// ─── Outer Envelope ────────────────────────────────────────────────────────

describe('buildOuterEnvelope()', () => {
  it('sets from_did and to_did correctly', () => {
    const kp = generateKeyPair();
    const outer = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc_middle', kp.privateKeyHex);

    expect(outer.from_did).toBe('did:aap:alice');
    expect(outer.to_did).toBe('did:aap:bob');
  });

  it('includes aap_version, nonce, ttl', () => {
    const kp = generateKeyPair();
    const outer = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc_middle', kp.privateKeyHex);

    expect(outer.aap_version).toBe('1.0');
    expect(outer.nonce).toHaveLength(64);
    expect(outer.ttl).toBe(30);
  });

  it('includes a timestamp close to now', () => {
    const kp = generateKeyPair();
    const before = Date.now();
    const outer = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc_middle', kp.privateKeyHex);
    const after = Date.now();

    expect(outer.timestamp).toBeGreaterThanOrEqual(before);
    expect(outer.timestamp).toBeLessThanOrEqual(after);
  });

  it('includes a message_id (UUID format)', () => {
    const kp = generateKeyPair();
    const outer = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc_middle', kp.privateKeyHex);

    expect(outer.message_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('includes a valid outer_signature', () => {
    const kp = generateKeyPair();
    const outer = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc_middle', kp.privateKeyHex);

    expect(outer.outer_signature).toBeTruthy();
    // Ed25519 signature is 64 bytes = 128 hex chars
    expect(outer.outer_signature).toHaveLength(128);
  });
});

// ─── Three-envelope round-trip ─────────────────────────────────────────────

describe('Three-envelope round-trip', () => {
  it('build → parseEnvelope returns valid: true', () => {
    const kp = generateKeyPair();
    const innerEnv = buildInnerEnvelope({ amount: 500, currency: 'USD', from_did: 'did:aap:alice' });
    const middleEnv = buildMiddleEnvelope(
      'PROPOSE_TRANSACTION',
      'cap-token',
      JSON.stringify(innerEnv),
      kp.privateKeyHex
    );
    const outerEnv = buildOuterEnvelope(
      'did:aap:alice',
      'did:aap:bob',
      JSON.stringify(middleEnv),
      kp.privateKeyHex
    );

    const result = parseEnvelope(outerEnv, kp.publicKeyHex);
    expect(result.valid).toBe(true);
  });

  it('parseEnvelope returns INVALID_SIGNATURE with wrong public key', () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();

    const inner = buildInnerEnvelope({ from_did: 'did:aap:alice' });
    const middle = buildMiddleEnvelope('PING', 'tok', JSON.stringify(inner), kp1.privateKeyHex);
    const outer = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', JSON.stringify(middle), kp1.privateKeyHex);

    const result = parseEnvelope(outer, kp2.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('parseEnvelope returns TIMESTAMP_EXPIRED for stale envelope', () => {
    const kp = generateKeyPair();
    const inner = buildInnerEnvelope({ from_did: 'did:aap:alice' });
    const middle = buildMiddleEnvelope('PING', 'tok', JSON.stringify(inner), kp.privateKeyHex);
    const outer = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', JSON.stringify(middle), kp.privateKeyHex);

    // Manually set a stale timestamp
    outer.timestamp = Date.now() - 60_000;

    const result = parseEnvelope(outer, kp.publicKeyHex);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('TIMESTAMP_EXPIRED');
  });

  it('each envelope in round-trip contains correct data', () => {
    const kp = generateKeyPair();
    const params = { transaction_id: 'txn-001', from_did: 'did:aap:alice' };

    const innerEnv = buildInnerEnvelope(params);
    expect(innerEnv.parameters).toEqual(params);

    const middleEnv = buildMiddleEnvelope('ACCEPT_TRANSACTION', 'cap', JSON.stringify(innerEnv), kp.privateKeyHex);
    expect(middleEnv.action_type).toBe('ACCEPT_TRANSACTION');

    // Recover inner from middle
    const recoveredInner = JSON.parse(middleEnv.inner_envelope_encrypted);
    expect(recoveredInner.parameters.transaction_id).toBe('txn-001');

    const outerEnv = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', JSON.stringify(middleEnv), kp.privateKeyHex);
    expect(outerEnv.from_did).toBe('did:aap:alice');

    // Recover middle from outer
    const recoveredMiddle = JSON.parse(outerEnv.middle_envelope_encrypted);
    expect(recoveredMiddle.action_type).toBe('ACCEPT_TRANSACTION');
  });

  it('two envelopes built at the same time have different message_ids', () => {
    const kp = generateKeyPair();
    const outer1 = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc', kp.privateKeyHex);
    const outer2 = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc', kp.privateKeyHex);
    expect(outer1.message_id).not.toBe(outer2.message_id);
  });

  it('two envelopes built at the same time have different nonces', () => {
    const kp = generateKeyPair();
    const outer1 = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc', kp.privateKeyHex);
    const outer2 = buildOuterEnvelope('did:aap:alice', 'did:aap:bob', 'enc', kp.privateKeyHex);
    expect(outer1.nonce).not.toBe(outer2.nonce);
  });
});
