/**
 * AAP Action Registry
 * The complete enumeration of all valid typed actions in the protocol.
 * NO natural language. NO free-form text. Typed actions only.
 */

export type ActionType =
  // Handshake
  | 'HANDSHAKE_INIT'
  | 'HANDSHAKE_RESPONSE'
  // Health
  | 'PING'
  | 'PONG'
  // Data
  | 'REQUEST_DATA'
  | 'RETURN_DATA'
  // Task
  | 'DELEGATE_TASK'
  | 'TASK_RESULT'
  // Commerce
  | 'REQUEST_QUOTE'
  | 'RETURN_QUOTE'
  | 'PROPOSE_TRANSACTION'
  | 'ACCEPT_TRANSACTION'
  | 'REJECT_TRANSACTION'
  // Auth
  | 'REQUEST_HUMAN_AUTH'
  | 'HUMAN_AUTH_RESPONSE'
  // System
  | 'ERROR'
  | 'DISCONNECT';

export const ACTION_REGISTRY: Set<ActionType> = new Set([
  'HANDSHAKE_INIT',
  'HANDSHAKE_RESPONSE',
  'PING',
  'PONG',
  'REQUEST_DATA',
  'RETURN_DATA',
  'DELEGATE_TASK',
  'TASK_RESULT',
  'REQUEST_QUOTE',
  'RETURN_QUOTE',
  'PROPOSE_TRANSACTION',
  'ACCEPT_TRANSACTION',
  'REJECT_TRANSACTION',
  'REQUEST_HUMAN_AUTH',
  'HUMAN_AUTH_RESPONSE',
  'ERROR',
  'DISCONNECT',
]);

// Required fields per action type
export const ACTION_SCHEMAS: Record<ActionType, string[]> = {
  HANDSHAKE_INIT:      ['from_did', 'certificate', 'dilithium_pubkey', 'nonce_a', 'timestamp'],
  HANDSHAKE_RESPONSE:  ['from_did', 'certificate', 'dilithium_pubkey', 'nonce_b', 'kyber_encapsulated_key', 'nonce_a_hash'],
  PING:                ['from_did', 'timestamp'],
  PONG:                ['from_did', 'timestamp'],
  REQUEST_DATA:        ['from_did', 'data_type', 'timestamp'],
  RETURN_DATA:         ['from_did', 'data_type', 'data', 'timestamp'],
  DELEGATE_TASK:       ['from_did', 'task_type', 'parameters', 'timestamp'],
  TASK_RESULT:         ['from_did', 'task_type', 'result', 'timestamp'],
  REQUEST_QUOTE:       ['from_did', 'product', 'timestamp'],
  RETURN_QUOTE:        ['from_did', 'product', 'quote', 'currency', 'timestamp'],
  PROPOSE_TRANSACTION: ['from_did', 'amount', 'currency', 'description', 'timestamp'],
  ACCEPT_TRANSACTION:  ['from_did', 'transaction_id', 'timestamp'],
  REJECT_TRANSACTION:  ['from_did', 'transaction_id', 'reason', 'timestamp'],
  REQUEST_HUMAN_AUTH:  ['from_did', 'action_hash', 'action_description', 'timestamp'],
  HUMAN_AUTH_RESPONSE: ['from_did', 'action_hash', 'approved', 'human_signature', 'timestamp'],
  ERROR:               ['from_did', 'error_code', 'message', 'timestamp'],
  DISCONNECT:          ['from_did', 'timestamp'],
};
