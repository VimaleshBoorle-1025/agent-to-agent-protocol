/**
 * CLI Tests — TDD
 * Tests command parsing, output, and keystore behavior without real network calls.
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock conf (keystore)
let storedIdentity: any = null;
jest.mock('conf', () => {
  return jest.fn().mockImplementation(() => ({
    get: (key: string) => key === 'identity' ? storedIdentity : undefined,
    set: (_key: string, val: any) => { storedIdentity = val; },
    has: (key: string) => key === 'identity' && storedIdentity !== null,
    delete: (_key: string) => { storedIdentity = null; },
  }));
});

import { loadIdentity, saveIdentity, clearIdentity, hasIdentity } from '../src/keystore';
import { sendCommand } from '../src/commands/send';

// ─── Keystore ─────────────────────────────────────────────────────────────

describe('Keystore', () => {
  beforeEach(() => { storedIdentity = null; });

  test('saveIdentity and loadIdentity roundtrip', () => {
    const id = {
      did: 'did:aap:test123',
      aap_address: 'aap://vimalesh.finance.manager',
      public_key_hex: 'a'.repeat(64),
      private_key_hex: 'b'.repeat(64),
      registered_at: new Date().toISOString(),
    };
    saveIdentity(id);
    expect(loadIdentity()).toEqual(id);
  });

  test('hasIdentity returns false when empty', () => {
    expect(hasIdentity()).toBe(false);
  });

  test('hasIdentity returns true after save', () => {
    saveIdentity({ did: 'd', aap_address: 'a', public_key_hex: 'p', private_key_hex: 'k', registered_at: '' });
    expect(hasIdentity()).toBe(true);
  });

  test('clearIdentity removes stored identity', () => {
    saveIdentity({ did: 'd', aap_address: 'a', public_key_hex: 'p', private_key_hex: 'k', registered_at: '' });
    clearIdentity();
    expect(loadIdentity()).toBeNull();
  });
});

// ─── Send Command ────────────────────────────────────────────────────────

describe('send command', () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    storedIdentity = { did: 'did:aap:test', aap_address: 'aap://test.dev.agent', public_key_hex: 'x', private_key_hex: 'y', registered_at: '' };
    consoleSpy.mockClear();
    mockFetch.mockClear();
  });

  afterAll(() => consoleSpy.mockRestore());

  test('rejects invalid JSON', async () => {
    await sendCommand('aap://demo.echo', 'not valid json');
    const output = consoleSpy.mock.calls.flat().join(' ');
    expect(output).toMatch(/Invalid JSON/i);
  });

  test('rejects missing action_type', async () => {
    await sendCommand('aap://demo.echo', '{"data":"hello"}');
    const output = consoleSpy.mock.calls.flat().join(' ');
    expect(output).toMatch(/action_type/i);
  });

  test('rejects unknown action_type', async () => {
    await sendCommand('aap://demo.echo', '{"action_type":"DO_EVIL"}');
    const output = consoleSpy.mock.calls.flat().join(' ');
    expect(output).toMatch(/Unknown action_type/i);
  });

  test('accepts valid action_type PING', async () => {
    await sendCommand('aap://demo.echo', '{"action_type":"PING","from_did":"did:aap:test","timestamp":123}');
    const output = consoleSpy.mock.calls.flat().join(' ');
    expect(output).toMatch(/PING/);
  });

  test('rejects if no identity', async () => {
    storedIdentity = null;
    await sendCommand('aap://demo.echo', '{"action_type":"PING"}');
    const output = consoleSpy.mock.calls.flat().join(' ');
    expect(output).toMatch(/No identity/i);
  });
});

// ─── Register Command ────────────────────────────────────────────────────

describe('register command', () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    storedIdentity = null;
    consoleSpy.mockClear();
    mockFetch.mockClear();
  });

  afterAll(() => consoleSpy.mockRestore());

  test('calls registry and saves identity on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ did: 'did:aap:xyz', aap_address: 'aap://test.agent.one' }),
    });

    const { registerCommand } = require('../src/commands/register');
    await registerCommand({ name: 'test.agent.one' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/register'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(hasIdentity()).toBe(true);
    const id = loadIdentity();
    expect(id?.did).toBe('did:aap:xyz');
    expect(id?.aap_address).toBe('aap://test.agent.one');
  });

  test('does not overwrite existing identity without --force', async () => {
    storedIdentity = { did: 'existing', aap_address: 'existing', public_key_hex: 'x', private_key_hex: 'y', registered_at: '' };
    const { registerCommand } = require('../src/commands/register');
    await registerCommand({ name: 'test.agent.two' });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(loadIdentity()?.did).toBe('existing');
  });

  test('handles registry error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'ADDRESS_TAKEN' }),
    });
    const { registerCommand } = require('../src/commands/register');
    await registerCommand({ name: 'test.taken', force: true });
    const output = consoleSpy.mock.calls.flat().join(' ');
    expect(output).toMatch(/ADDRESS_TAKEN/);
    expect(hasIdentity()).toBe(false);
  });
});

// ─── Whoami ──────────────────────────────────────────────────────────────

describe('whoami command', () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  afterAll(() => consoleSpy.mockRestore());

  test('shows identity when registered', () => {
    storedIdentity = { did: 'did:aap:abc', aap_address: 'aap://my.test.agent', public_key_hex: 'x'.repeat(64), private_key_hex: 'y', registered_at: '2026-04-15T00:00:00Z' };
    const { whoamiCommand } = require('../src/commands/whoami');
    consoleSpy.mockClear();
    whoamiCommand();
    const output = consoleSpy.mock.calls.flat().join(' ');
    expect(output).toMatch(/aap:\/\/my\.test\.agent/);
    expect(output).toMatch(/did:aap:abc/);
  });

  test('shows error when no identity', () => {
    storedIdentity = null;
    const { whoamiCommand } = require('../src/commands/whoami');
    consoleSpy.mockClear();
    whoamiCommand();
    const output = consoleSpy.mock.calls.flat().join(' ');
    expect(output).toMatch(/No identity/i);
  });
});
