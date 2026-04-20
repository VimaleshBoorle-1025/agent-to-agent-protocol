import { ActionType } from '@a2a_protocol/aap-intent-compiler';

export interface AAPAgentConfig {
  name: string;
  capabilities?: string[];
  onMessage?: MessageHandler;
  registryUrl?: string;
  keyStorePath?: string;
  /** 'ed25519' (default, fast) or 'dilithium3' (post-quantum, larger keys) */
  signatureAlgorithm?: 'ed25519' | 'dilithium3';
}

export interface AAPMessage {
  action_type: ActionType;
  from_did: string;
  message_id: string;
  timestamp: number;
  [key: string]: unknown;
}

export type MessageHandler = (msg: AAPMessage) => Promise<unknown>;

export interface AgentIdentity {
  did: string;
  aap_address: string;
  public_key_hex: string;
}

export interface AgentProfile {
  name: string;
  bio?: string;
  location?: string;
  capabilities?: string[];
}
