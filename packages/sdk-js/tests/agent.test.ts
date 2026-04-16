/**
 * Tests for AAPAgent — key generation, register() payload structure,
 * signature correctness, and getCapabilityManifest().
 */

import { AAPAgent } from '../src/agent';
import { verify } from '../../crypto/src/ed25519';
import { ACTION_REGISTRY } from '../../intent-compiler/src/action-registry';

// ─── Mock fetch globally ───────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeRegistryResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      did: 'did:aap:test.agent',
      aap_address: 'aap://test.agent',
      public_key_hex: 'aabbcc',
      ...overrides,
    }),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('AAPAgent.register()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends POST to /v1/register with correct structure', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const agent = new AAPAgent({ name: 'test.agent' });
    await agent.register();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/register');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body);
    expect(body.aap_address).toBe('aap://test.agent');
    expect(body.owner_type).toBe('human');
  });

  it('includes a real 64-char Ed25519 public_key_hex', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const agent = new AAPAgent({ name: 'test.agent' });
    await agent.register();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.public_key_hex).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(body.public_key_hex)).toBe(true);
  });

  it('includes timestamp and nonce in request body', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const before = Date.now();
    const agent = new AAPAgent({ name: 'test.agent' });
    await agent.register();
    const after = Date.now();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.timestamp).toBeLessThanOrEqual(after);
    expect(body.nonce).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(/^[0-9a-f]+$/.test(body.nonce)).toBe(true);
  });

  it('includes a valid Ed25519 signature over the body', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const agent = new AAPAgent({ name: 'test.agent' });
    await agent.register();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const { signature, ...bodyWithoutSig } = body;

    // Recreate what was signed
    const signatureInput = new TextEncoder().encode(JSON.stringify(bodyWithoutSig));
    const isValid = verify(signatureInput, signature, body.public_key_hex);
    expect(isValid).toBe(true);
  });

  it('signature is not the placeholder string', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const agent = new AAPAgent({ name: 'test.agent' });
    await agent.register();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.signature).not.toBe('placeholder');
    expect(body.signature.length).toBeGreaterThan(64);
  });

  it('throws when registry returns an error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'name already taken' }),
    });

    const agent = new AAPAgent({ name: 'test.agent' });
    await expect(agent.register()).rejects.toThrow('Registration failed: name already taken');
  });

  it('stores identity after successful registration', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const agent = new AAPAgent({ name: 'test.agent' });
    const identity = await agent.register();

    expect(identity.did).toBe('did:aap:test.agent');
    expect(agent.getIdentity()?.did).toBe('did:aap:test.agent');
  });
});

// ─── getCapabilityManifest() ──────────────────────────────────────────────

describe('AAPAgent.getCapabilityManifest()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns a valid L2 manifest after registration', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const agent = new AAPAgent({
      name: 'test.agent',
      capabilities: ['REQUEST_QUOTE', 'DELEGATE_TASK'],
    });
    await agent.register();

    const manifest = agent.getCapabilityManifest();
    expect(manifest.level).toBe(2);
    expect(manifest.agent_did).toBe('did:aap:test.agent');
    expect(manifest.allowed_actions).toContain('REQUEST_QUOTE');
    expect(manifest.allowed_actions).toContain('RETURN_QUOTE');
    expect(manifest.allowed_actions).toContain('DELEGATE_TASK');
    expect(manifest.allowed_actions).toContain('TASK_RESULT');
    expect(manifest.allowed_actions).toContain('PING');
    expect(manifest.denied_actions).toHaveLength(0);
  });

  it('manifest contains future expiry date', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const agent = new AAPAgent({ name: 'test.agent' });
    await agent.register();

    const manifest = agent.getCapabilityManifest();
    expect(new Date(manifest.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('all allowed_actions are valid AAP action types', async () => {
    mockFetch.mockResolvedValueOnce(makeRegistryResponse());

    const agent = new AAPAgent({
      name: 'test.agent',
      capabilities: ['REQUEST_DATA', 'PROPOSE_TRANSACTION', 'REQUEST_HUMAN_AUTH'],
    });
    await agent.register();

    const manifest = agent.getCapabilityManifest();
    for (const action of manifest.allowed_actions) {
      expect(ACTION_REGISTRY.has(action as any)).toBe(true);
    }
  });

  it('works without registration (uses name as DID)', () => {
    const agent = new AAPAgent({ name: 'my.agent' });
    const manifest = agent.getCapabilityManifest();
    expect(manifest.agent_did).toBe('did:aap:my.agent');
    expect(manifest.level).toBe(2);
  });
});

// ─── AAPAgent.lookup() ────────────────────────────────────────────────────

describe('AAPAgent.lookup()', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calls registry lookup endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ did: 'did:aap:other.agent' }),
    });

    const result = await AAPAgent.lookup('aap://other.agent');
    expect(result.did).toBe('did:aap:other.agent');
    expect(mockFetch.mock.calls[0][0]).toContain('/v1/lookup/');
  });

  it('throws when agent not found', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(AAPAgent.lookup('aap://unknown')).rejects.toThrow('Agent not found');
  });
});
