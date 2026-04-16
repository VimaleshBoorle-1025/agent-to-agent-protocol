import { v4 as uuidv4 } from 'uuid';
import { AAPAgentConfig, AgentIdentity, MessageHandler } from './types';
import { AAPSession } from './session';
import { DEFAULT_REGISTRY_URL } from './constants';

export class AAPAgent {
  private config: AAPAgentConfig;
  private identity?: AgentIdentity;
  private messageHandler?: MessageHandler;
  private registryUrl: string;

  constructor(config: AAPAgentConfig) {
    this.config = config;
    this.registryUrl = config.registryUrl || DEFAULT_REGISTRY_URL;
    if (config.onMessage) {
      this.messageHandler = config.onMessage;
    }
  }

  /**
   * Register this agent with the AAP Registry.
   * Generates a key pair if one doesn't exist, then registers the aap:// address.
   */
  async register(): Promise<AgentIdentity> {
    // Generate Ed25519 key pair (Dilithium3 requires native bindings — use Ed25519 as fallback)
    const keyPair = await this.generateKeyPair();

    const aap_address = `aap://${this.config.name}`;
    const endpoint_url = `https://agent.${this.config.name.replace(/\./g, '-')}.local`;

    const response = await fetch(`${this.registryUrl}/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aap_address,
        public_key_hex: keyPair.publicKeyHex,
        endpoint_url,
        capabilities: this.config.capabilities || [],
        owner_type: 'human',
        signature: 'placeholder', // TODO: sign with private key
      }),
    });

    if (!response.ok) {
      const err = await response.json() as { error: string };
      throw new Error(`Registration failed: ${err.error}`);
    }

    const data = await response.json() as AgentIdentity;
    this.identity = { ...data, public_key_hex: keyPair.publicKeyHex };
    console.log(`✅ Registered: ${aap_address}`);
    console.log(`   DID: ${this.identity.did}`);
    return this.identity;
  }

  /**
   * Connect to another agent. Performs the AAP handshake.
   */
  async connect(address: string): Promise<AAPSession> {
    if (!this.identity) throw new Error('Agent not registered. Call register() first.');
    const session = new AAPSession(this.identity, address, this.registryUrl);
    await session.handshake();
    return session;
  }

  /**
   * Register a handler for incoming messages.
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Look up any agent by aap:// address.
   */
  static async lookup(address: string, registryUrl = DEFAULT_REGISTRY_URL) {
    const encoded = encodeURIComponent(address);
    const response = await fetch(`${registryUrl}/v1/lookup/${encoded}`);
    if (!response.ok) throw new Error(`Agent not found: ${address}`);
    return response.json();
  }

  /**
   * Verify another agent's identity and trust score.
   */
  async verify(did: string) {
    const response = await fetch(`${this.registryUrl}/v1/agent/${did}/trust`);
    if (!response.ok) throw new Error(`Could not verify DID: ${did}`);
    return response.json();
  }

  getIdentity(): AgentIdentity | undefined {
    return this.identity;
  }

  private async generateKeyPair(): Promise<{ publicKeyHex: string; privateKeyHex: string }> {
    // Placeholder key generation. Production: use noble-crypto Dilithium3 or Ed25519.
    const randomBytes = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
    return {
      publicKeyHex: `ed25519_pub_${randomBytes}`,
      privateKeyHex: `ed25519_prv_${randomBytes}`,
    };
  }
}
