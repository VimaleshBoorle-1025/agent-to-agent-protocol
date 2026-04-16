import chalk from 'chalk';
import ora, { Ora } from 'ora';

export const ok    = (msg: string) => console.log(chalk.green('  ✅ ' + msg));
export const fail  = (msg: string) => console.log(chalk.red('  ❌ ' + msg));
export const info  = (msg: string) => console.log(chalk.cyan('  ℹ  ' + msg));
export const warn  = (msg: string) => console.log(chalk.yellow('  ⚠  ' + msg));
export const dim   = (msg: string) => console.log(chalk.gray('     ' + msg));
export const bell  = (msg: string) => console.log(chalk.blue('  🔔 ' + msg));

export function spinner(text: string): Ora {
  return ora({ text, color: 'cyan' }).start();
}

export function stepOk(spin: Ora, text: string, detail?: string) {
  spin.succeed(chalk.white(text) + (detail ? chalk.gray('  ' + detail) : ''));
}

export function stepFail(spin: Ora, text: string) {
  spin.fail(chalk.red(text));
}

export function printAgent(agent: any) {
  console.log();
  console.log(chalk.bold('  ' + agent.aapAddress || agent.aap_address));
  console.log(chalk.gray('  DID: ') + agent.id);
  console.log(chalk.gray('  Trust: ') + trustBadge(agent.trustScore, agent.verificationLevel));
  if (agent.service?.[0]?.serviceEndpoint) {
    console.log(chalk.gray('  Endpoint: ') + agent.service[0].serviceEndpoint);
  }
  console.log();
}

function trustBadge(score: number, level: string): string {
  const badge = level === 'personal_verified'  ? chalk.green('✓ personal')
              : level === 'business_verified'   ? chalk.yellow('✓ business')
              : level === 'enterprise'           ? chalk.magenta('✓ enterprise')
              : chalk.gray('unverified');
  return `${score} ${badge}`;
}
