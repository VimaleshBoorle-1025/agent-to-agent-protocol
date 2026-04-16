import Conf from 'conf';

interface AAPIdentity {
  did:            string;
  aap_address:    string;
  public_key_hex: string;
  private_key_hex: string;
  registered_at:  string;
}

const store = new Conf<{ identity?: AAPIdentity }>({
  projectName: 'aap-cli',
  configName:  'identity',
});

export function saveIdentity(identity: AAPIdentity): void {
  store.set('identity', identity);
}

export function loadIdentity(): AAPIdentity | null {
  return store.get('identity') ?? null;
}

export function clearIdentity(): void {
  store.delete('identity');
}

export function hasIdentity(): boolean {
  return store.has('identity');
}

export type { AAPIdentity };
