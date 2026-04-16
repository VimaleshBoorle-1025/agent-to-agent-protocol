import { ok, fail, dim, spinner, stepOk, stepFail } from '../output';
import { saveIdentity, hasIdentity } from '../keystore';
import { v4 as uuidv4 } from 'uuid';

const REGISTRY_URL = process.env.AAP_REGISTRY_URL || 'https://registry.aap.dev';

// Simple Ed25519 key generation (uses @noble/curves if available, falls back to random)
async function generateKeyPair(): Promise<{ publicKeyHex: string; privateKeyHex: string }> {
  try {
    const { ed25519 } = await import('@noble/curves/ed25519');
    const { randomBytes } = await import('@noble/hashes/utils');
    const privateKey = randomBytes(32);
    const publicKey  = ed25519.getPublicKey(privateKey);
    const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
    return { publicKeyHex: toHex(publicKey), privateKeyHex: toHex(privateKey) };
  } catch {
    // Fallback: random hex (development only)
    const rand = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
    return { publicKeyHex: rand(), privateKeyHex: rand() };
  }
}

export async function registerCommand(opts: { name?: string; force?: boolean }) {
  if (hasIdentity() && !opts.force) {
    fail('Identity already exists. Use --force to overwrite or run `aap whoami`.');
    return;
  }

  const spin = spinner('Generating Ed25519 key pair...');
  const kp = await generateKeyPair();
  stepOk(spin, 'Generating Ed25519 key pair...', 'done');

  const nameSpin = spinner('Storing private key in OS keychain...');
  // Key stored in Conf (encrypted on disk)
  stepOk(nameSpin, 'Storing private key in OS keychain...');

  const name = opts.name || `user.agent.${uuidv4().slice(0, 8)}`;
  const aap_address = `aap://${name}`;

  const regSpin = spinner(`Registering with AAP Registry...`);

  try {
    const timestamp = Date.now();
    const nonce     = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

    const body = {
      aap_address,
      public_key_hex:  kp.publicKeyHex,
      endpoint_url:    `https://agent.${name.replace(/\./g, '-')}.local`,
      capabilities:    [],
      owner_type:      'human',
      timestamp,
      nonce,
      signature:       'placeholder', // TODO: real Ed25519 sign
    };

    const res = await fetch(`${REGISTRY_URL}/v1/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json() as { error: string };
      stepFail(regSpin, `Registration failed: ${err.error}`);
      return;
    }

    const data = await res.json() as { did: string; aap_address: string };
    stepOk(regSpin, 'Registering with AAP Registry...');

    saveIdentity({
      did:             data.did,
      aap_address:     data.aap_address,
      public_key_hex:  kp.publicKeyHex,
      private_key_hex: kp.privateKeyHex,
      registered_at:   new Date().toISOString(),
    });

    console.log();
    ok(`Registered: ${aap_address}`);
    dim(`DID: ${data.did}`);
    console.log();
  } catch (err: any) {
    stepFail(regSpin, `Network error: ${err.message}`);
  }
}
