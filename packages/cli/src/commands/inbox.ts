import { loadIdentity } from '../keystore';
import { fail, ok, dim, info } from '../output';
import chalk from 'chalk';

const MAILBOX_URL = process.env.AAP_MAILBOX_URL || 'https://mailbox.aap.dev';

export async function inboxCommand() {
  const identity = loadIdentity();
  if (!identity) { fail('No identity. Run `aap register` first.'); return; }

  try {
    const res = await fetch(`${MAILBOX_URL}/v1/messages/inbox`, {
      headers: { Authorization: `DID ${identity.did}:placeholder-sig` },
    });
    if (!res.ok) { fail('Failed to fetch inbox.'); return; }

    const data = await res.json() as { messages: any[]; count: number };
    if (data.count === 0) {
      info('Inbox is empty.');
      return;
    }

    console.log();
    ok(`${data.count} pending message(s)`);
    data.messages.forEach((m, i) => {
      console.log(chalk.bold(`\n  [${i + 1}] from ${m.from_did}`));
      dim(`Message ID: ${m.message_id}`);
      dim(`Received:   ${new Date(m.created_at).toLocaleString()}`);
      dim(`Expires:    ${new Date(m.expires_at).toLocaleString()}`);
    });
    console.log();
  } catch (err: any) {
    fail(`Error: ${err.message}`);
  }
}
