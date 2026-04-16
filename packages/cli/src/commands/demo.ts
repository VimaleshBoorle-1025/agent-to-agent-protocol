import { ok, fail, info, spinner, stepOk, stepFail, dim } from '../output';
import { loadIdentity } from '../keystore';
import chalk from 'chalk';

const REGISTRY_URL = process.env.AAP_REGISTRY_URL || 'https://registry.aap.dev';

const DEMO_AGENTS = [
  { address: 'aap://demo.echo',        description: 'Echoes back whatever it receives' },
  { address: 'aap://demo.weather',     description: 'Returns mock weather data' },
  { address: 'aap://demo.bank.balance',description: 'Returns mock bank balance ($4,821.00)' },
  { address: 'aap://demo.insurance',   description: 'Returns mock insurance quotes' },
  { address: 'aap://demo.slowpoke',    description: 'Responds after 3s (tests async)' },
  { address: 'aap://demo.rejector',    description: 'Rejects every request (tests errors)' },
];

export async function demoCommand() {
  const identity = loadIdentity();
  if (!identity) { fail('No identity. Run `aap register` first.'); return; }

  console.log();
  info('AAP Demo Agents');
  console.log();
  DEMO_AGENTS.forEach(a => {
    console.log(chalk.cyan(`  ${a.address}`));
    console.log(chalk.gray(`    ${a.description}`));
  });
  console.log();

  // Try connecting to demo.echo
  const spin = spinner('Connecting to aap://demo.echo...');
  try {
    const res = await fetch(`${REGISTRY_URL}/v1/lookup/${encodeURIComponent('aap://demo.echo')}`);
    if (res.ok) {
      stepOk(spin, 'Connected to aap://demo.echo');
      ok('PING → PONG successful');
    } else {
      stepFail(spin, 'Demo agent not yet deployed (registry not live)');
      dim('Deploy the registry server first: npm run dev:registry');
    }
  } catch {
    stepFail(spin, 'Registry not reachable (run services locally first)');
  }
  console.log();
}
