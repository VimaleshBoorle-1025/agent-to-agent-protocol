/**
 * Demo agent message handlers.
 * Each handler receives a parsed AAP inner envelope and returns a response.
 */

export interface AAPIncomingMessage {
  action_type: string;
  from_did: string;
  message_id: string;
  timestamp: number;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AAPResponse {
  status: 'ok' | 'error';
  message_id: string;
  action_type: string;
  payload?: Record<string, unknown>;
  error?: string;
}

// ── Echo Agent ──────────────────────────────────────────────────────────────

export function echoHandler(msg: AAPIncomingMessage): AAPResponse {
  if (msg.action_type === 'PING') {
    return {
      status: 'ok',
      message_id: msg.message_id,
      action_type: 'PONG',
      payload: { echo: msg.parameters, pong_at: Date.now() },
    };
  }
  if (msg.action_type === 'REQUEST_DATA') {
    return {
      status: 'ok',
      message_id: msg.message_id,
      action_type: 'RETURN_DATA',
      payload: {
        echo: msg.parameters,
        agent: 'demo.echo.agent',
        returned_at: Date.now(),
      },
    };
  }
  return {
    status: 'error',
    message_id: msg.message_id,
    action_type: msg.action_type,
    error: `ACTION_NOT_SUPPORTED: ${msg.action_type}`,
  };
}

// ── Weather Agent ────────────────────────────────────────────────────────────

const WEATHER_STUB: Record<string, { temp_c: number; condition: string }> = {
  london:       { temp_c: 12, condition: 'Cloudy' },
  'new york':   { temp_c: 18, condition: 'Partly Cloudy' },
  singapore:    { temp_c: 31, condition: 'Humid and Sunny' },
  toronto:      { temp_c: 5,  condition: 'Light Snow' },
  sydney:       { temp_c: 22, condition: 'Clear' },
};

export function weatherHandler(msg: AAPIncomingMessage): AAPResponse {
  if (msg.action_type === 'REQUEST_DATA') {
    const location = (msg.parameters?.location as string ?? '').toLowerCase();
    const weather  = WEATHER_STUB[location] ?? { temp_c: 20, condition: 'Unknown' };
    return {
      status: 'ok',
      message_id: msg.message_id,
      action_type: 'RETURN_DATA',
      payload: {
        location: msg.parameters?.location ?? 'Unknown',
        ...weather,
        unit: 'celsius',
        as_of: new Date().toISOString(),
        source: 'demo.weather.agent (stub)',
      },
    };
  }
  if (msg.action_type === 'PING') {
    return { status: 'ok', message_id: msg.message_id, action_type: 'PONG', payload: { agent: 'demo.weather.agent' } };
  }
  return { status: 'error', message_id: msg.message_id, action_type: msg.action_type, error: `ACTION_NOT_SUPPORTED: ${msg.action_type}` };
}

// ── Finance Agent ─────────────────────────────────────────────────────────────

export function financeHandler(msg: AAPIncomingMessage): AAPResponse {
  if (msg.action_type === 'REQUEST_QUOTE') {
    const asset = (msg.parameters?.asset as string ?? 'BTC').toUpperCase();
    const stubs: Record<string, number> = {
      BTC: 62350.00, ETH: 3180.50, SOL: 142.30, AAPL: 189.40, TSLA: 177.20,
    };
    const price = stubs[asset] ?? 0;
    return {
      status: 'ok',
      message_id: msg.message_id,
      action_type: 'RETURN_DATA',
      payload: {
        asset,
        price_usd: price,
        currency: 'USD',
        as_of: new Date().toISOString(),
        source: 'demo.finance.agent (stub)',
      },
    };
  }
  if (msg.action_type === 'READ_BANK_BALANCE') {
    return {
      status: 'ok',
      message_id: msg.message_id,
      action_type: 'RETURN_DATA',
      payload: {
        account: msg.parameters?.account ?? 'demo-account',
        balance_usd: 10000.00,
        currency: 'USD',
        as_of: new Date().toISOString(),
        source: 'demo.finance.agent (stub)',
      },
    };
  }
  if (msg.action_type === 'PING') {
    return { status: 'ok', message_id: msg.message_id, action_type: 'PONG', payload: { agent: 'demo.finance.agent' } };
  }
  return { status: 'error', message_id: msg.message_id, action_type: msg.action_type, error: `ACTION_NOT_SUPPORTED: ${msg.action_type}` };
}
