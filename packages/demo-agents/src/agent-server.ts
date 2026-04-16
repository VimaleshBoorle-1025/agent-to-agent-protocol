/**
 * Generic AAP demo agent server.
 * One binary — AGENT_NAME env var selects the handler.
 * Registers itself with the AAP registry on startup.
 */

import Fastify from 'fastify';
import { echoHandler, weatherHandler, financeHandler, AAPIncomingMessage, AAPResponse } from './handlers';

type HandlerFn = (msg: AAPIncomingMessage) => AAPResponse;

const AGENT_HANDLERS: Record<string, HandlerFn> = {
  'demo.echo.agent':    echoHandler,
  'demo.weather.agent': weatherHandler,
  'demo.finance.agent': financeHandler,
};

const AGENT_CAPABILITIES: Record<string, string[]> = {
  'demo.echo.agent':    ['PING', 'REQUEST_DATA'],
  'demo.weather.agent': ['PING', 'REQUEST_DATA'],
  'demo.finance.agent': ['PING', 'REQUEST_QUOTE', 'READ_BANK_BALANCE'],
};

export async function buildAgentServer(opts: {
  agentName: string;
  registryUrl: string;
  port: number;
}) {
  const { agentName, registryUrl, port } = opts;
  const handler = AGENT_HANDLERS[agentName] ?? echoHandler;

  const app = Fastify({ logger: { level: 'info' } });

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', agent: agentName }));

  // ── Handshake endpoint ──────────────────────────────────────────────────────
  app.post('/handshake', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    // Echo back a nonce_b — session key derivation happens in the SDK
    reply.send({
      status: 'accepted',
      agent: agentName,
      nonce_b: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
      timestamp: Date.now(),
    });
  });

  // ── Message endpoint ────────────────────────────────────────────────────────
  app.post('/message', async (req, reply) => {
    const envelope = req.body as Record<string, unknown>;

    // Extract inner message — in production the SDK decrypts envelopes first.
    // Demo agents accept unencrypted messages for ease of testing.
    let msg: AAPIncomingMessage;
    try {
      // Try to parse inner parameters directly from the flat message
      msg = {
        action_type: (envelope.action_type as string) ?? 'PING',
        from_did:    (envelope.from_did as string) ?? 'unknown',
        message_id:  (envelope.message_id as string) ?? 'unknown',
        timestamp:   (envelope.timestamp as number) ?? Date.now(),
        parameters:  (envelope.parameters as Record<string, unknown>) ?? {},
        ...envelope,
      };
    } catch {
      return reply.status(400).send({ error: 'MALFORMED_MESSAGE' });
    }

    const response = handler(msg);
    reply.send(response);
  });

  // ── Register with AAP registry on startup ───────────────────────────────────
  app.addHook('onReady', async () => {
    try {
      const { generateKeyPair, sign, generateNonce } = await import('@noble/curves/ed25519').catch(() => null) as any ?? {};
      if (!generateKeyPair) return; // SDK not available in demo build, skip

      const endpointUrl = `http://localhost:${port}`;
      const capabilities = AGENT_CAPABILITIES[agentName] ?? ['PING'];
      const aap_address  = `aap://${agentName}`;

      const regRes = await fetch(`${registryUrl}/v1/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aap_address,
          endpoint_url:   endpointUrl,
          capabilities,
          owner_type:     'ai',
          public_key_hex: '0'.repeat(64), // placeholder key for demo
          nonce:          Date.now().toString(16),
          timestamp:      Date.now(),
          signature:      '0'.repeat(128),
        }),
      }).catch(() => null);

      if (regRes?.ok) {
        const data = await regRes.json();
        app.log.info(`✅ Registered: ${aap_address} → DID: ${(data as any).did}`);
      } else {
        app.log.warn(`Registration skipped for ${agentName} (registry not ready or address taken)`);
      }
    } catch (err) {
      app.log.warn(`Could not auto-register: ${err}`);
    }
  });

  return app;
}
