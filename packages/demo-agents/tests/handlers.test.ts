import { echoHandler, weatherHandler, financeHandler } from '../src/handlers';

// ── Echo Agent ───────────────────────────────────────────────────────────────

describe('echoHandler', () => {
  const base = { from_did: 'did:aap:test', message_id: 'msg-1', timestamp: Date.now() };

  it('responds to PING with PONG', () => {
    const res = echoHandler({ ...base, action_type: 'PING', parameters: { from: 'test' } });
    expect(res.status).toBe('ok');
    expect(res.action_type).toBe('PONG');
    expect(res.payload?.echo).toBeDefined();
    expect(res.payload?.pong_at).toBeDefined();
  });

  it('responds to REQUEST_DATA with RETURN_DATA', () => {
    const res = echoHandler({ ...base, action_type: 'REQUEST_DATA', parameters: { key: 'val' } });
    expect(res.status).toBe('ok');
    expect(res.action_type).toBe('RETURN_DATA');
    expect(res.payload?.echo).toEqual({ key: 'val' });
  });

  it('returns error for unsupported action', () => {
    const res = echoHandler({ ...base, action_type: 'TRANSFER_FUNDS' });
    expect(res.status).toBe('error');
    expect(res.error).toContain('ACTION_NOT_SUPPORTED');
  });
});

// ── Weather Agent ─────────────────────────────────────────────────────────────

describe('weatherHandler', () => {
  const base = { from_did: 'did:aap:test', message_id: 'msg-2', timestamp: Date.now() };

  it('returns weather data for known city', () => {
    const res = weatherHandler({ ...base, action_type: 'REQUEST_DATA', parameters: { location: 'London' } });
    expect(res.status).toBe('ok');
    expect(res.action_type).toBe('RETURN_DATA');
    expect(res.payload?.temp_c).toBe(12);
    expect(res.payload?.condition).toBe('Cloudy');
  });

  it('returns default weather for unknown city', () => {
    const res = weatherHandler({ ...base, action_type: 'REQUEST_DATA', parameters: { location: 'Atlantis' } });
    expect(res.status).toBe('ok');
    expect(res.payload?.condition).toBe('Unknown');
  });

  it('responds to PING', () => {
    const res = weatherHandler({ ...base, action_type: 'PING' });
    expect(res.status).toBe('ok');
    expect(res.action_type).toBe('PONG');
  });
});

// ── Finance Agent ─────────────────────────────────────────────────────────────

describe('financeHandler', () => {
  const base = { from_did: 'did:aap:test', message_id: 'msg-3', timestamp: Date.now() };

  it('returns BTC quote', () => {
    const res = financeHandler({ ...base, action_type: 'REQUEST_QUOTE', parameters: { asset: 'BTC' } });
    expect(res.status).toBe('ok');
    expect(res.payload?.asset).toBe('BTC');
    expect(typeof res.payload?.price_usd).toBe('number');
  });

  it('returns bank balance', () => {
    const res = financeHandler({ ...base, action_type: 'READ_BANK_BALANCE', parameters: { account: 'acc-001' } });
    expect(res.status).toBe('ok');
    expect(res.payload?.balance_usd).toBe(10000.00);
  });

  it('returns zero for unknown asset', () => {
    const res = financeHandler({ ...base, action_type: 'REQUEST_QUOTE', parameters: { asset: 'DOGE' } });
    expect(res.status).toBe('ok');
    expect(res.payload?.price_usd).toBe(0);
  });
});
