import { ActionType } from '@aap/intent-compiler';

export interface AAPAgentConfig {
  name: string;
  capabilities?: string[];
  onMessage?: MessageHandler;
  registryUrl?: string;
  keyStorePath?: string;
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
