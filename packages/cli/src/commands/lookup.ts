import { fail, printAgent, spinner, stepOk, stepFail } from '../output';

const REGISTRY_URL = process.env.AAP_REGISTRY_URL || 'https://registry.aap.dev';

export async function lookupCommand(address: string) {
  const spin = spinner(`Looking up ${address}...`);
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(`${REGISTRY_URL}/v1/lookup/${encoded}`);
    if (!res.ok) {
      stepFail(spin, `Not found: ${address}`);
      return;
    }
    const agent = await res.json();
    stepOk(spin, `Found`);
    printAgent(agent);
  } catch (err: any) {
    stepFail(spin, `Error: ${err.message}`);
  }
}
