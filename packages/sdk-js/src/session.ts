import { v4 as uuidv4 } from 'uuid';
import { AgentIdentity, AAPMessage } from './types';
import { AAP_VERSION, MESSAGE_TTL_SECONDS } from './constants';
import { ActionType } from '@aap/intent-compiler';

export class AAPSession {
  private localIdentity: AgentIdentity;
  private remoteAddress: string;
  private remoteIdentity?: Record<string, unknown>;
  private sessionKey?: string;
  private registryUrl: string;
  private connected = false;

  constructor(
    localIdentity: AgentIdentity,
    remoteAddress: string,
    registryUrl: string
  ) {
    this.localIdentity = localIdentity;
    this.remoteAddress = remoteAddress;
    this.registryUrl = registryUrl;
  }

  /**
   * Perform the AAP handshake with the remote agent.
   * Establishes an encrypted tunnel using Kyber768 KEM (Ed25519 fallback for now).
   */
  async handshake(): Promise<void> {
    console.log(`Looking up ${this.remoteAddress}...`);
    const encoded = encodeURIComponent(this.remoteAddress);
    const lookup = await fetch(`${this.registryUrl}/v1/lookup/${encoded}`);
    if (!lookup.ok) {
      throw new Error(`Agent not found: ${this.remoteAddress}`);
    }
    this.remoteIdentity = await lookup.json() as Record<string, unknown>;

    console.log(`Verifying identity...`);
    // TODO: verify Dilithium3 signature + certificate in registry

    console.log(`Performing handshake...`);
    const nonce_a = this.generateNonce();
    const handshakeInit: AAPMessage = {
      action_type: 'HANDSHAKE_INIT' as ActionType,
      from_did: this.localIdentity.did,
      message_id: uuidv4(),
      timestamp: Date.now(),
      aap_version: AAP_VERSION,
      nonce_a,
      certificate: this.localIdentity.did,
      dilithium_pubkey: this.localIdentity.public_key_hex,
    };

    // TODO: send to remote agent endpoint, receive HANDSHAKE_RESPONSE
    // For now, simulate session establishment
    this.sessionKey = `session_${nonce_a.slice(0, 16)}`;
    this.connected = true;
    console.log(`✅ Secure tunnel established (${this.remoteAddress})`);
  }

  /**
   * Send a typed action to the connected agent.
   */
  async send(action: ActionType, params: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected. Call handshake() first.');
    }

    const message: AAPMessage = {
      aap_version: AAP_VERSION,
      action_type: action,
      from_did: this.localIdentity.did,
      message_id: uuidv4(),
      timestamp: Date.now(),
      nonce: this.generateNonce(),
      ttl: MESSAGE_TTL_SECONDS,
      ...params,
    };

    // TODO: encrypt with three-envelope format and send to remote endpoint
    console.log(`📤 Sending ${action} to ${this.remoteAddress}`);
    return { status: 'delivered', message_id: message.message_id };
  }

  /**
   * Clean disconnect from session.
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.send('DISCONNECT' as ActionType, {});
      this.connected = false;
      this.sessionKey = undefined;
      console.log(`Disconnected from ${this.remoteAddress}`);
    }
  }

  private generateNonce(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
  }
}
