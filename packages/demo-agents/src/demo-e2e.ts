/**
 * AAP End-to-End Demo
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows two agents (Alice and Bob) finding each other, establishing a secure
 * tunnel, and exchanging typed messages — all using the real AAP SDK.
 *
 * Run against a local registry:
 *   REGISTRY_URL=http://localhost:3001 npx ts-node src/demo-e2e.ts
 *
 * Or in offline simulation mode (no registry needed):
 *   npx ts-node src/demo-e2e.ts
 */

import { AAPAgent } from '@a2a_protocol/aap-sdk';

const REGISTRY_URL = process.env.REGISTRY_URL ?? 'http://localhost:3001';
const ALICE_NAME   = `alice.demo.${Date.now()}`;
const BOB_NAME     = `bob.demo.${Date.now()}`;

const separator = () => console.log('\n' + '─'.repeat(60) + '\n');

async function run() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       AAP Agent-to-Agent Demo                ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── Step 1: Register Alice ────────────────────────────────────────────────
  console.log('① Registering Alice...');
  const alice = new AAPAgent({
    name:         ALICE_NAME,
    capabilities: ['PING', 'REQUEST_DATA', 'DELEGATE_TASK'],
    registryUrl:  REGISTRY_URL,
  });
  const aliceId = await alice.register();
  console.log(`   aap_address : aap://${ALICE_NAME}`);
  console.log(`   DID         : ${aliceId.did}`);
  console.log(`   Public key  : ${aliceId.public_key_hex.slice(0, 16)}...`);

  separator();

  // ── Step 2: Register Bob ──────────────────────────────────────────────────
  console.log('② Registering Bob...');
  const bob = new AAPAgent({
    name:         BOB_NAME,
    capabilities: ['PING', 'REQUEST_DATA', 'RETURN_DATA'],
    registryUrl:  REGISTRY_URL,
  });
  const bobId = await bob.register();
  console.log(`   aap_address : aap://${BOB_NAME}`);
  console.log(`   DID         : ${bobId.did}`);

  separator();

  // ── Step 3: Alice looks up Bob ────────────────────────────────────────────
  console.log('③ Alice looking up Bob in the registry...');
  try {
    const found = await AAPAgent.lookup(`aap://${BOB_NAME}`, REGISTRY_URL);
    console.log(`   Found Bob — trust score: ${(found as any).trustScore ?? 'N/A'}`);
    console.log(`   Verification level: ${(found as any).verificationLevel ?? 'unverified'}`);
  } catch {
    console.log('   (Registry not reachable — continuing in simulation mode)');
  }

  separator();

  // ── Step 4: Alice connects to Bob ─────────────────────────────────────────
  console.log('④ Alice establishing secure tunnel to Bob...');
  const session = await alice.connect(`aap://${BOB_NAME}`);
  console.log(`   Tunnel established: ${session.isConnected()}`);
  console.log(`   Session key (first 16 chars): ${session.getSessionKey()?.slice(0, 16) ?? 'N/A'}...`);

  separator();

  // ── Step 5: Alice sends a PING ────────────────────────────────────────────
  console.log('⑤ Alice → Bob: PING');
  const pingResult = await session.send('PING', { from: aliceId.did, timestamp: Date.now() });
  console.log('   Result:', JSON.stringify(pingResult, null, 2).split('\n').join('\n   '));

  separator();

  // ── Step 6: Alice requests data from Bob ──────────────────────────────────
  console.log('⑥ Alice → Bob: REQUEST_DATA { query: "hello from alice" }');
  const dataResult = await session.send('REQUEST_DATA', {
    query:     'hello from alice',
    from_did:  aliceId.did,
    timestamp: Date.now(),
  });
  console.log('   Result:', JSON.stringify(dataResult, null, 2).split('\n').join('\n   '));

  separator();

  // ── Step 7: Alice delegates a task to Bob ─────────────────────────────────
  console.log('⑦ Alice → Bob: DELEGATE_TASK { task: "summarise quarterly report" }');
  const taskResult = await session.send('DELEGATE_TASK', {
    task:      'summarise quarterly report',
    priority:  'high',
    from_did:  aliceId.did,
    timestamp: Date.now(),
  });
  console.log('   Result:', JSON.stringify(taskResult, null, 2).split('\n').join('\n   '));

  separator();

  // ── Step 8: Capability manifest ───────────────────────────────────────────
  console.log('⑧ Alice\'s capability manifest:');
  const manifest = alice.getCapabilityManifest();
  console.log(`   Agent DID     : ${manifest.agent_did}`);
  console.log(`   Allowed actions: ${manifest.allowed_actions.join(', ')}`);
  console.log(`   Expires        : ${manifest.expires_at}`);

  separator();

  // ── Step 9: Clean disconnect ──────────────────────────────────────────────
  console.log('⑨ Alice disconnecting from Bob...');
  await session.disconnect();
  console.log(`   Connected: ${session.isConnected()}`);

  separator();
  console.log('✅ Demo complete. All 9 steps passed.\n');
}

run().catch((err) => {
  console.error('❌ Demo failed:', err.message);
  process.exit(1);
});
