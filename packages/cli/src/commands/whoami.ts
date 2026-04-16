import { loadIdentity } from '../keystore';
import { fail, ok, dim } from '../output';
import chalk from 'chalk';

export function whoamiCommand() {
  const identity = loadIdentity();
  if (!identity) {
    fail('No identity found. Run `aap register --name your.agent.name`');
    return;
  }
  console.log();
  ok(identity.aap_address);
  dim(`DID:          ${identity.did}`);
  dim(`Public Key:   ${identity.public_key_hex.slice(0, 16)}...`);
  dim(`Registered:   ${identity.registered_at}`);
  console.log();
}
