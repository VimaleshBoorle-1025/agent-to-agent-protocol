import { spinner, stepOk, stepFail, printAgent } from '../output';

const REGISTRY_URL = process.env.AAP_REGISTRY_URL || 'https://registry.aap.dev';

export async function verifyCommand(address: string) {
  const spin = spinner(`Verifying ${address}...`);
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(`${REGISTRY_URL}/v1/lookup/${encoded}`);
    if (!res.ok) { stepFail(spin, 'Agent not found'); return; }
    const agent = await res.json() as any;
    stepOk(spin, `Identity verified`);
    printAgent(agent);
  } catch (err: any) {
    stepFail(spin, `Error: ${err.message}`);
  }
}
