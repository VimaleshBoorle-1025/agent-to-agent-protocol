#!/usr/bin/env node
import { Command } from 'commander';
import { registerCommand }  from './commands/register';
import { lookupCommand }    from './commands/lookup';
import { connectCommand }   from './commands/connect';
import { sendCommand }      from './commands/send';
import { whoamiCommand }    from './commands/whoami';
import { inboxCommand }     from './commands/inbox';
import { verifyCommand }    from './commands/verify';
import { demoCommand }      from './commands/demo';
import chalk from 'chalk';

const program = new Command();

program
  .name('aap')
  .description('AAP CLI — Agent Authentication Protocol developer tool')
  .version('1.0.0');

// ─── Identity ──────────────────────────────────────────────────────────────

program
  .command('register')
  .description('Register a new agent. Generates keys and publishes aap:// address.')
  .option('--name <name>', 'Agent name (e.g. vimalesh.finance.manager)')
  .option('--force', 'Overwrite existing identity')
  .action((opts) => registerCommand(opts));

program
  .command('whoami')
  .description('Show current agent identity and address')
  .action(() => whoamiCommand());

program
  .command('revoke')
  .description('Revoke agent identity (emergency use)')
  .action(() => {
    const { clearIdentity } = require('./keystore');
    clearIdentity();
    console.log(chalk.red('  Identity revoked from local keystore.'));
  });

// ─── Discovery ─────────────────────────────────────────────────────────────

program
  .command('lookup <address>')
  .description('Look up any agent by aap:// address')
  .action((address) => lookupCommand(address));

program
  .command('verify <address>')
  .description('Verify an agent identity and trust score')
  .action((address) => verifyCommand(address));

program
  .command('trust <address>')
  .description('Get detailed trust record for an agent')
  .action((address) => verifyCommand(address)); // same as verify for now

// ─── Communication ─────────────────────────────────────────────────────────

program
  .command('connect <address>')
  .description('Connect to another agent (full AAP handshake)')
  .action((address) => connectCommand(address));

program
  .command('send <address> <json>')
  .description('Send a typed AAP action to an agent')
  .action((address, json) => sendCommand(address, json));

program
  .command('listen')
  .description('Start listening for incoming connections')
  .action(() => {
    const { info } = require('./output');
    info('Listening for incoming connections... (press Ctrl+C to stop)');
    // TODO: start local HTTP server accepting AAP connections
    process.on('SIGINT', () => { console.log('\n  Stopped.'); process.exit(0); });
  });

// ─── Mailbox ───────────────────────────────────────────────────────────────

program
  .command('inbox')
  .description('Check pending messages in your mailbox')
  .action(() => inboxCommand());

// ─── Agent Info ────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show active connections and agent status')
  .action(() => {
    const { loadIdentity } = require('./keystore');
    const id = loadIdentity();
    if (!id) { console.log('  No active identity.'); return; }
    console.log(`\n  ${id.aap_address}\n  DID: ${id.did}\n  Status: online\n`);
  });

program
  .command('audit')
  .description('View your agent audit log')
  .action(() => {
    const { info } = require('./output');
    info('Audit log: use `GET /v1/audit/agent/<your-did-hash>` on the audit server.');
  });

program
  .command('capabilities')
  .description('Show your agent capability manifest')
  .action(() => {
    const { loadIdentity } = require('./keystore');
    const id = loadIdentity();
    if (!id) { console.log('  No identity.'); return; }
    console.log(JSON.stringify({
      agent_did:        id.did,
      level:            1,
      allowed_actions:  ['PING', 'REQUEST_DATA', 'DELEGATE_TASK'],
      denied_actions:   [],
      allowed_data_types: [],
      denied_data_types:  [],
    }, null, 2));
  });

// ─── Demo ──────────────────────────────────────────────────────────────────

program
  .command('demo')
  .description('Connect to AAP demo agents for testing')
  .action(() => demoCommand());

program.parse(process.argv);
