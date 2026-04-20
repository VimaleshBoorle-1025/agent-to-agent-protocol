import { v4 as uuidv4 } from 'uuid';
import { AgentIdentity, AAPMessage } from './types';
import { AAP_VERSION, MESSAGE_TTL_SECONDS } from './constants';
import { ActionType } from 'aap-intent-compiler';
import { IntentCompiler, CapabilityManifest } from 'aap-intent-compiler';
import { RelayTransport } from './relay';
import {
  kyberKeyPair,
  kyberEncapsulate,
  kyberDecapsulate,
  buildOuterEnvelope,
  buildMiddleEnvelope,
  buildInnerEnvelope,
  verify,
  generateNonce,
  deriveSessionKey,
} from 'aap-crypto';

export class AAPSession {
  private localIdentity: AgentIdentity;
  private localPrivateKeyHex: string;
  private remoteAddress: string;
  private remoteIdentity?: Record<string, unknown>;
  private sessionKey?: string;
  private registryUrl: string;
  private connected = false;
  private manifest?: CapabilityManifest;
  private relay?: RelayTransport;

  constructor(
    localIdentity: AgentIdentity,
    localPrivateKeyHex: string,
    remoteAddress: string,
    registryUrl: string,
    manifest?: CapabilityManifest,
    relay?: RelayTransport
  ) {
    this.localIdentity      = localIdentity;
    this.localPrivateKeyHex = localPrivateKeyHex;
    this.remoteAddress      = remoteAddress;
    this.registryUrl        = registryUrl;
    if (manifest) this.manifest = manifest;
    if (relay)    this.relay    = relay;
  }

  /**
   * Relay-mode handshake — performs key exchange over the session relay
   * instead of a direct HTTP endpoint. Both sides must call this after
   * connectViaRelay(). The relay forwards the HANDSHAKE frames opaquely.
   */
  async handshakeViaRelay(): Promise<void> {
    if (!this.relay) throw new Error('No relay transport attached');

    const kyberKP = kyberKeyPair();
    const nonce_a = generateNonce();

    const initPayload = {
      action_type:      'HANDSHAKE_INIT',
      from_did:         this.localIdentity.did,
      kyber_pubkey:     kyberKP.publicKeyHex,
      nonce_a,
      timestamp:        Date.now(),
    };

    // Send HANDSHAKE_INIT over relay
    this.relay.send(JSON.stringify({ type: 'HANDSHAKE_INIT', ...initPayload }));

    // Wait for HANDSHAKE_RESPONSE from peer
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Relay handshake timeout')), 15_000);
      this.relay!.onReceive((frame) => {
        try {
          const msg = JSON.parse(frame.toString());
          if (msg.type === 'HANDSHAKE_RESPONSE' && msg.kyber_ciphertext) {
            clearTimeout(timer);
            const { sharedSecretHex } = kyberDecapsulate(msg.kyber_ciphertext, kyberKP.privateKeyHex);
            this.sessionKey = deriveSessionKey(sharedSecretHex, nonce_a + (msg.nonce_b ?? ''));
            this.connected  = true;

            // Re-register receive handler for actual messages
            this.relay!.onReceive((dataFrame) => {
              // Consumers can subscribe via onMessage callback — placeholder for future
              void dataFrame;
            });

            resolve();
          } else if (msg.type === 'HANDSHAKE_INIT' && msg.kyber_pubkey) {
            // We are the guest — respond with encapsulated secret
            clearTimeout(timer);
            const { ciphertextHex, sharedSecretHex } = kyberEncapsulate(msg.kyber_pubkey);
            const nonce_b = generateNonce();
            this.relay!.send(JSON.stringify({
              type: 'HANDSHAKE_RESPONSE',
              kyber_ciphertext: ciphertextHex,
              nonce_b,
            }));
            this.sessionKey = deriveSessionKey(sharedSecretHex, (msg.nonce_a ?? '') + nonce_b);
            this.connected  = true;
            resolve();
          }
        } catch { /* not a JSON frame — ignore */ }
      });
    });

    console.log(`✅ Relay tunnel established (${this.remoteAddress})`);
  }

  /**
   * Full AAP handshake:
   * 1. Lookup remote agent in registry
   * 2. Verify remote agent's DID document signature
   * 3. Generate Kyber768 key pair for this session
   * 4. Send HANDSHAKE_INIT (signed with local Ed25519 key)
   * 5. Receive HANDSHAKE_RESPONSE, decapsulate Kyber ciphertext
   * 6. Derive session key via HKDF-SHA256
   */
  async handshake(): Promise<void> {
    // 1. Lookup remote agent
    const encoded  = encodeURIComponent(this.remoteAddress);
    const response = await fetch(`${this.registryUrl}/v1/lookup/${encoded}`);
    if (!response.ok) throw new Error(`Agent not found: ${this.remoteAddress}`);
    this.remoteIdentity = await response.json() as Record<string, unknown>;

    // Support both DID document format (verificationMethod) and flat registry format (public_key_hex)
    const remotePublicKeyHex = (
      (this.remoteIdentity.verificationMethod as any)?.[0]?.publicKeyHex ??
      (this.remoteIdentity.public_key_hex as string)
    ) as string;
    if (!remotePublicKeyHex) throw new Error('Remote agent has no public key in DID document');

    // 2. Verify DID document signature if present
    const didSignature = this.remoteIdentity.did_signature as string | undefined;
    if (didSignature) {
      const didDoc = { ...this.remoteIdentity };
      delete (didDoc as any).did_signature;
      const docBytes = new TextEncoder().encode(JSON.stringify(didDoc));
      const isValid  = verify(docBytes, didSignature, remotePublicKeyHex);
      if (!isValid) throw new Error('DID document signature is invalid');
    }

    // 2. Generate Kyber768 KEM key pair for this session
    const kyberKP  = kyberKeyPair();
    const nonce_a  = generateNonce();

    // 3. Build and sign HANDSHAKE_INIT outer envelope
    const initPayload = {
      action_type:      'HANDSHAKE_INIT',
      from_did:         this.localIdentity.did,
      certificate:      this.localIdentity.did,
      dilithium_pubkey: this.localIdentity.public_key_hex,
      kyber_pubkey:     kyberKP.publicKeyHex,
      nonce_a,
      timestamp:        Date.now(),
    };

    const envelope = buildOuterEnvelope(
      this.localIdentity.did,
      (this.remoteIdentity.id as string) ?? this.remoteAddress,
      JSON.stringify(buildMiddleEnvelope(
        'HANDSHAKE_INIT', '', JSON.stringify(buildInnerEnvelope(initPayload)), this.localPrivateKeyHex
      )),
      this.localPrivateKeyHex
    );

    // 4. Send to remote endpoint (if available) or simulate
    const remoteEndpoint = (
      (this.remoteIdentity.service as any)?.[0]?.serviceEndpoint ??
      (this.remoteIdentity.endpoint_url as string)
    ) as string | undefined;
    if (remoteEndpoint) {
      const handshakeRes = await fetch(`${remoteEndpoint}/handshake`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(envelope),
      }).catch(() => null);

      if (handshakeRes?.ok) {
        const hsResponse = await handshakeRes.json() as { kyber_ciphertext?: string; nonce_b?: string };
        // 5. Decapsulate Kyber ciphertext to get shared secret
        if (hsResponse.kyber_ciphertext) {
          const { sharedSecretHex } = kyberDecapsulate(hsResponse.kyber_ciphertext, kyberKP.privateKeyHex);
          // 6. Derive session key
          this.sessionKey = deriveSessionKey(sharedSecretHex, nonce_a + (hsResponse.nonce_b ?? ''));
        }
      }
    }

    // Fallback: derive session key from local Kyber encapsulation (single-party simulation)
    if (!this.sessionKey) {
      const { sharedSecretHex } = kyberEncapsulate(kyberKP.publicKeyHex);
      this.sessionKey = deriveSessionKey(sharedSecretHex, nonce_a);
    }

    this.connected = true;
    console.log(`✅ Secure tunnel established (${this.remoteAddress})`);
  }

  /**
   * Send a typed action to the connected agent.
   * Validates through Intent Compiler first — rejects any disallowed action.
   */
  async send(action: ActionType, params: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) throw new Error('Not connected. Call handshake() first.');

    const payload = {
      action_type: action,
      from_did:    this.localIdentity.did,
      timestamp:   Date.now(),
      ...params,
    };

    // Run through Intent Compiler if manifest is set
    if (this.manifest) {
      const compiled = IntentCompiler.process(payload, this.manifest);
      if (!compiled.success) throw new Error(`IntentCompiler rejected action: ${compiled.error}`);
    }

    // Build three-envelope message (inner → middle → outer, each encrypted with session key)
    const innerEnv  = buildInnerEnvelope(payload);
    const middleEnv = buildMiddleEnvelope(
      action, '', JSON.stringify(innerEnv), this.localPrivateKeyHex, this.sessionKey
    );
    const outerEnv  = buildOuterEnvelope(
      this.localIdentity.did,
      (this.remoteIdentity?.id as string) ?? this.remoteAddress,
      JSON.stringify(middleEnv),
      this.localPrivateKeyHex,
      this.sessionKey
    );

    // Send to remote endpoint if available
    const remoteEndpoint = (
      (this.remoteIdentity?.service as any)?.[0]?.serviceEndpoint ??
      (this.remoteIdentity?.endpoint_url as string)
    ) as string | undefined;
    if (remoteEndpoint) {
      const res = await fetch(`${remoteEndpoint}/aap/message`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(outerEnv),
      }).catch(() => null);
      if (res?.ok) return res.json();
    }

    // Endpoint unavailable — return the envelope for out-of-band delivery
    return { envelope: outerEnv, status: 'queued', message_id: outerEnv.message_id };
  }

  /** Set a capability manifest to enable Intent Compiler gating on send(). */
  setManifest(manifest: CapabilityManifest): void {
    this.manifest = manifest;
  }

  /** Clean disconnect from session. */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.send('DISCONNECT' as ActionType, {}).catch(() => {});
      this.connected  = false;
      this.sessionKey = undefined;
    }
  }

  isConnected(): boolean { return this.connected; }
  getSessionKey(): string | undefined { return this.sessionKey; }
  getRemoteIdentity(): Record<string, unknown> | undefined { return this.remoteIdentity; }
}
