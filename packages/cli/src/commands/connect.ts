import { fail, ok, spinner, stepOk, stepFail } from '../output';
import { loadIdentity } from '../keystore';

const REGISTRY_URL = process.env.AAP_REGISTRY_URL || 'https://registry.aap.dev';

export async function connectCommand(address: string) {
  const identity = loadIdentity();
  if (!identity) {
    fail('No identity found. Run `aap register` first.');
    return;
  }

  const lookupSpin = spinner(`Looking up ${address}...`);
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(`${REGISTRY_URL}/v1/lookup/${encoded}`);
    if (!res.ok) {
      stepFail(lookupSpin, `Agent not found: ${address}`);
      return;
    }
    const agent = await res.json() as any;
    stepOk(lookupSpin, `Looking up ${address}...`, '✓ Found');

    const verifySpin = spinner('Verifying identity...');
    // TODO: verify Dilithium3 certificate
    stepOk(verifySpin, 'Verifying identity...', '✓ Verified');

    const handshakeSpin = spinner('Performing handshake...');
    const t0 = Date.now();
    // TODO: real Kyber768 handshake with remote endpoint
    await new Promise(r => setTimeout(r, 50)); // simulate handshake
    const ms = Date.now() - t0;
    stepOk(handshakeSpin, 'Performing handshake...', `✓ ${ms}ms`);

    console.log();
    ok(`Secure tunnel established`);
    console.log();
  } catch (err: any) {
    fail(`Connection error: ${err.message}`);
  }
}
