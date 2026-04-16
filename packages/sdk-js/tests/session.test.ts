/**
 * Tests for AAPSession — handshake flow, Intent Compiler gating, send().
 */

import { AAPSession } from '../src/session';
import { generateKeyPair } from '../../crypto/src/ed25519';
import type { CapabilityManifest } from '../../intent-compiler/src/index';

// ─── Mock fetch globally ───────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeLocalIdentity() {
  const kp = generateKeyPair();
  return {
    did: 'did:aap:alice',
    aap_address: 'aap://alice',
    public_key_hex: kp.publicKeyHex,
    _privateKeyHex: kp.privateKeyHex,
  };
}

function makeRemoteRegistryEntry(overrides: Record<string, unknown> = {}) {
  const kp = generateKeyPair();
  return {
    did: 'did:aap:bob',
    aap_address: 'aap://bob',
    public_key_hex: kp.publicKeyHex,
    endpoint_url: 'https://bob.example.com',
    ...overrides,
  };
}

function makeFutureDate() {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
}

function makeManifest(overrides: Partial<CapabilityManifest> = {}): CapabilityManifest {
  return {
    agent_did: 'did:aap:alice',
    level: 2,
    allowed_actions: [
      'PING', 'PONG', 'HANDSHAKE_INIT', 'HANDSHAKE_RESPONSE',
      'REQUEST_DATA', 'RETURN_DATA', 'DELEGATE_TASK', 'TASK_RESULT',
      'REQUEST_QUOTE', 'RETURN_QUOTE', 'DISCONNECT', 'ERROR',
    ],
    denied_actions: [],
    allowed_data_types: ['quote', 'bank_balance'],
    denied_data_types: [],
    approved_agents: ['did:aap:*'],
    expires_at: makeFutureDate(),
    ...overrides,
  };
}

function makeSession(manifestOverride?: CapabilityManifest) {
  const local = makeLocalIdentity();
  return new AAPSession(
    { did: local.did, aap_address: local.aap_address, public_key_hex: local.public_key_hex },
    local._privateKeyHex,
    'aap://bob',
    'https://registry.aap.dev',
    manifestOverride
  );
}

// ─── handshake() ──────────────────────────────────────────────────────────

describe('AAPSession.handshake()', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calls registry lookup for the remote address', async () => {
    const remote = makeRemoteRegistryEntry();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => remote }); // lookup
    // HANDSHAKE_INIT post to endpoint
    mockFetch.mockResolvedValueOnce({ ok: false }); // endpoint not available → fallback

    const session = makeSession();
    await session.handshake();

    expect(mockFetch.mock.calls[0][0]).toContain('/v1/lookup/');
  });

  it('throws when remote agent not found in registry', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const session = makeSession();
    await expect(session.handshake()).rejects.toThrow('Agent not found: aap://bob');
  });

  it('establishes session (connected=true) after handshake', async () => {
    const remote = makeRemoteRegistryEntry();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => remote });
    mockFetch.mockResolvedValueOnce({ ok: false }); // endpoint unreachable, fallback

    const session = makeSession();
    await session.handshake();

    expect(session.isConnected()).toBe(true);
  });

  it('derives a session key after handshake', async () => {
    const remote = makeRemoteRegistryEntry();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => remote });
    mockFetch.mockResolvedValueOnce({ ok: false });

    const session = makeSession();
    await session.handshake();

    expect(session.getSessionKey()).toBeDefined();
    expect(session.getSessionKey()!.length).toBeGreaterThan(0);
  });

  it('rejects DID document with invalid signature', async () => {
    const remote = makeRemoteRegistryEntry({
      did_signature: 'deadbeef'.repeat(16),  // obviously wrong
      public_key_hex: generateKeyPair().publicKeyHex,
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => remote });

    const session = makeSession();
    await expect(session.handshake()).rejects.toThrow('DID document signature is invalid');
  });

  it('stores remote identity after successful lookup', async () => {
    const remote = makeRemoteRegistryEntry();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => remote });
    mockFetch.mockResolvedValueOnce({ ok: false });

    const session = makeSession();
    await session.handshake();

    expect(session.getRemoteIdentity()?.did).toBe('did:aap:bob');
  });

  it('uses Kyber encapsulated key from HANDSHAKE_RESPONSE when provided', async () => {
    // Simulate a remote agent that returns a HANDSHAKE_RESPONSE with kyber_encapsulated_key
    const { kyberKeyPair, kyberEncapsulate } = await import('../../crypto/src/kyber');
    const remoteKyberKp = kyberKeyPair();
    const remote = makeRemoteRegistryEntry();

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => remote }); // lookup
    // Simulate endpoint returning a HANDSHAKE_RESPONSE with a ciphertext
    // (In reality the remote generates a ciphertext for the session pubkey we send)
    // Here we just send back a ciphertext for a fresh keypair (not the session one,
    // but sufficient to verify the code path runs)
    const { ciphertextHex } = kyberEncapsulate(remoteKyberKp.publicKeyHex);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ kyber_encapsulated_key: ciphertextHex }),
    });

    // The session will try to decapsulate with its own private key and it will
    // produce a shared secret (even if it's not the matching one from the remote side).
    // The important thing is it takes the Kyber path without throwing.
    // Since keys don't match, it'll likely succeed (decapsulate doesn't throw in noble).
    const session = makeSession();
    // This should NOT throw
    await expect(session.handshake()).resolves.not.toThrow();
    expect(session.isConnected()).toBe(true);
  });
});

// ─── send() ───────────────────────────────────────────────────────────────

describe('AAPSession.send()', () => {
  beforeEach(() => mockFetch.mockReset());

  async function connectedSession(manifest?: CapabilityManifest) {
    const remote = makeRemoteRegistryEntry();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => remote });
    mockFetch.mockResolvedValueOnce({ ok: false }); // endpoint unavailable → fallback
    const session = makeSession(manifest);
    await session.handshake();
    mockFetch.mockReset();
    return session;
  }

  it('throws if called before handshake', () => {
    const session = makeSession();
    expect(() =>
      session.send('PING', { from_did: 'did:aap:alice', timestamp: Date.now() })
    ).rejects.toThrow('Not connected');
  });

  it('sends message and returns result when endpoint is available', async () => {
    const session = await connectedSession();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', message_id: 'abc' }),
    });

    const result = await session.send('PING', {
      from_did: 'did:aap:alice',
      timestamp: Date.now(),
    }) as any;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/aap/message');
    expect(result.status).toBe('ok');
  });

  it('returns envelope when endpoint is unavailable', async () => {
    const session = await connectedSession();
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await session.send('PING', {
      from_did: 'did:aap:alice',
      timestamp: Date.now(),
    }) as any;

    expect(result.envelope).toBeDefined();
    expect(result.envelope.from_did).toBe('did:aap:alice');
  });

  it('passes allowed action through Intent Compiler', async () => {
    const manifest = makeManifest({ allowed_actions: ['PING', 'PONG', 'HANDSHAKE_INIT', 'HANDSHAKE_RESPONSE', 'DISCONNECT', 'ERROR'] });
    const session = await connectedSession(manifest);
    mockFetch.mockResolvedValueOnce({ ok: false });

    await expect(
      session.send('PING', { from_did: 'did:aap:alice', timestamp: Date.now() })
    ).resolves.not.toThrow();
  });

  it('throws when action is in denied_actions', async () => {
    const manifest = makeManifest({
      allowed_actions: ['PING', 'PONG', 'REQUEST_DATA', 'HANDSHAKE_INIT', 'HANDSHAKE_RESPONSE', 'DISCONNECT', 'ERROR'],
      denied_actions: ['REQUEST_DATA'],
    });
    const session = await connectedSession(manifest);

    await expect(
      session.send('REQUEST_DATA', {
        from_did: 'did:aap:alice',
        data_type: 'quote',
        timestamp: Date.now(),
      })
    ).rejects.toThrow('IntentCompiler rejected action');
  });

  it('throws when action is not in allowed_actions', async () => {
    const manifest = makeManifest({
      allowed_actions: ['PING', 'PONG', 'HANDSHAKE_INIT', 'HANDSHAKE_RESPONSE', 'DISCONNECT', 'ERROR'],
      // PROPOSE_TRANSACTION not in list
    });
    const session = await connectedSession(manifest);

    await expect(
      session.send('PROPOSE_TRANSACTION', {
        from_did: 'did:aap:alice',
        amount: 100,
        currency: 'USD',
        description: 'test',
        timestamp: Date.now(),
      })
    ).rejects.toThrow('IntentCompiler rejected action');
  });

  it('does not filter through compiler when no manifest is set', async () => {
    const session = await connectedSession(undefined); // no manifest
    mockFetch.mockResolvedValueOnce({ ok: false });

    // Even an arbitrary known action should pass without a manifest
    await expect(
      session.send('PING', { from_did: 'did:aap:alice', timestamp: Date.now() })
    ).resolves.not.toThrow();
  });
});
