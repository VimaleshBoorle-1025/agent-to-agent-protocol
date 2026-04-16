import { fail, ok, warn } from '../output';
import { loadIdentity } from '../keystore';

export async function sendCommand(address: string, jsonPayload: string) {
  const identity = loadIdentity();
  if (!identity) { fail('No identity. Run `aap register` first.'); return; }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch {
    fail('Invalid JSON payload. Message must be valid JSON.');
    return;
  }

  if (!parsed.action_type) {
    fail('Missing action_type in payload. AAP only accepts typed actions.');
    return;
  }

  const VALID_ACTIONS = new Set([
    'PING','PONG','REQUEST_DATA','RETURN_DATA','DELEGATE_TASK','TASK_RESULT',
    'REQUEST_QUOTE','RETURN_QUOTE','PROPOSE_TRANSACTION','ACCEPT_TRANSACTION',
    'REJECT_TRANSACTION','REQUEST_HUMAN_AUTH','HUMAN_AUTH_RESPONSE','ERROR','DISCONNECT',
  ]);

  if (!VALID_ACTIONS.has(parsed.action_type as string)) {
    fail(`Unknown action_type: ${parsed.action_type}. See AAP Action Registry.`);
    return;
  }

  // TODO: send via established session (requires active connection)
  ok(`Sent ${parsed.action_type} to ${address}`);
}
