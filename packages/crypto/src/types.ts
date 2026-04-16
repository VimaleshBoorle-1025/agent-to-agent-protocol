export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  publicKeyHex: string;
  privateKeyHex: string;
  algorithm: 'ed25519' | 'dilithium3';
}

export interface SignedMessage {
  message: Uint8Array;
  signature: Uint8Array;
  signatureHex: string;
  publicKeyHex: string;
}

export interface OuterEnvelope {
  aap_version: string;
  from_did: string;
  to_did: string;
  message_id: string;
  timestamp: number;
  nonce: string;
  ttl: number;
  middle_envelope_encrypted: string; // hex-encoded encrypted middle envelope
  outer_signature: string;           // hex-encoded Dilithium3/Ed25519 signature
}

export interface MiddleEnvelope {
  action_type: string;
  capability_token: string;
  schema_version: string;
  inner_envelope_encrypted: string; // hex-encoded encrypted inner envelope
  middle_signature: string;
}

export interface InnerEnvelope {
  parameters: Record<string, unknown>;
}
