import { AAPAgentConfig, AgentIdentity, MessageHandler } from './types';
import { AAPSession } from './session';
import { DEFAULT_REGISTRY_URL } from './constants';
import {
  generateKeyPair,
  sign,
  generateNonce,
  validateTimestamp,
  dilithium3KeyPair,
  dilithium3Sign,
} from '@aap/crypto';

export class AAPAgent {
  private config: AAPAgentConfig;
  private identity?: AgentIdentity;
  private privateKeyHex?: string;
  private messageHandler?: MessageHandler;
  private registryUrl: string;

  constructor(config: AAPAgentConfig) {
    this.config = config;
    this.registryUrl = config.registryUrl || DEFAULT_REGISTRY_URL;
    if (config.onMessage) this.messageHandler = config.onMessage;
  }

  /**
   * Register this agent with the AAP Registry.
   * Generates a real Ed25519 key pair, signs the registration body,
   * and publishes the aap:// address.
   */
  async register(): Promise<AgentIdentity> {
    // Generate key pair — Ed25519 (default) or Dilithium3 (post-quantum)
    const algo = this.config.signatureAlgorithm ?? 'ed25519';
    const kp = algo === 'dilithium3' ? dilithium3KeyPair() : generateKeyPair();
    this.privateKeyHex = kp.privateKeyHex;

    const aap_address  = `aap://${this.config.name}`;
    const endpoint_url = `https://agent.${this.config.name.replace(/\./g, '-')}.local`;
    const timestamp    = Date.now();
    const nonce        = generateNonce();

    // Build body without signature for signing
    const bodyToSign = {
      aap_address,
      public_key_hex:  kp.publicKeyHex,
      endpoint_url,
      capabilities:    this.config.capabilities || [],
      owner_type:      'human',
      timestamp,
      nonce,
    };

    // Sign the body with the chosen algorithm
    const messageBytes = new TextEncoder().encode(JSON.stringify(bodyToSign));
    const signature = algo === 'dilithium3'
      ? dilithium3Sign(messageBytes, kp.privateKeyHex)
      : sign(messageBytes, kp.privateKeyHex);

    const response = await fetch(`${this.registryUrl}/v1/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...bodyToSign, signature }),
    });

    if (!response.ok) {
      const err = await response.json() as { error: string };
      throw new Error(`Registration failed: ${err.error}`);
    }

    const data = await response.json() as { did: string; aap_address: string };
    this.identity = { ...data, public_key_hex: kp.publicKeyHex };

    console.log(`✅ Registered: ${aap_address}`);
    console.log(`   DID: ${this.identity.did}`);
    return this.identity;
  }

  /**
   * Connect to another agent. Looks up their DID document,
   * verifies their identity, and performs the AAP handshake.
   */
  async connect(address: string): Promise<AAPSession> {
    if (!this.identity || !this.privateKeyHex) {
      throw new Error('Agent not registered. Call register() first.');
    }
    const session = new AAPSession(
      this.identity,
      this.privateKeyHex,
      address,
      this.registryUrl
    );
    await session.handshake();
    return session;
  }

  /** Register a handler for incoming messages. */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Returns a default L2 task manifest for the configured capabilities.
   */
  getCapabilityManifest() {
    const caps = this.config.capabilities?.map(c => c.toString()) ?? [];

    // Always include PING + DISCONNECT + ERROR as baseline
    const base = new Set(['PING', 'PONG', 'DISCONNECT', 'ERROR', ...caps]);

    // Auto-include paired response actions
    const pairs: Record<string, string> = {
      REQUEST_DATA:        'RETURN_DATA',
      REQUEST_QUOTE:       'RETURN_QUOTE',
      DELEGATE_TASK:       'TASK_RESULT',
      PROPOSE_TRANSACTION: 'ACCEPT_TRANSACTION',
      REQUEST_HUMAN_AUTH:  'HUMAN_AUTH_RESPONSE',
      HANDSHAKE_INIT:      'HANDSHAKE_RESPONSE',
    };
    for (const [req, res] of Object.entries(pairs)) {
      if (base.has(req)) base.add(res);
    }

    return {
      agent_did:          this.identity?.did ?? `did:aap:${this.config.name}`,
      level:              2,
      allowed_actions:    Array.from(base),
      denied_actions:     [],
      allowed_data_types: [],
      denied_data_types:  [],
      approved_agents:    [],
      expires_at:         new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /** Look up any agent by aap:// address. */
  static async lookup(address: string, registryUrl = DEFAULT_REGISTRY_URL) {
    const encoded  = encodeURIComponent(address);
    const response = await fetch(`${registryUrl}/v1/lookup/${encoded}`);
    if (!response.ok) throw new Error(`Agent not found: ${address}`);
    return response.json();
  }

  /** Verify another agent's identity and trust score. */
  async verify(did: string) {
    const response = await fetch(`${this.registryUrl}/v1/agent/${did}/trust`);
    if (!response.ok) throw new Error(`Could not verify DID: ${did}`);
    return response.json();
  }

  getIdentity(): AgentIdentity | undefined { return this.identity; }
}
