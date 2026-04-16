import { createHash } from 'crypto';

const GENESIS_PREV_HASH = '0'.repeat(64);

/**
 * Compute a chain entry hash.
 * entry_hash = SHA256(prev_hash || agent_did_hash || action_type || outcome || timestamp || content_hash)
 */
export function computeEntryHash(
  prevHash: string,
  agentDidHash: string,
  actionType: string,
  outcome: string,
  timestamp: number,
  contentHash: string
): string {
  const data = `${prevHash}${agentDidHash}${actionType}${outcome}${timestamp}${contentHash}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Hash an agent DID for privacy (never store raw DIDs in public chain).
 */
export function hashAgentDid(did: string): string {
  return createHash('sha256').update(did).digest('hex');
}

/**
 * Hash arbitrary content (e.g. message payload hash).
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Verify the integrity of the entire chain.
 * Recomputes every entry_hash and checks the prev_hash linkage.
 * Returns { valid, length, broken_at? }
 */
export function verifyChain(entries: ChainEntry[]): ChainVerifyResult {
  if (entries.length === 0) return { valid: true, length: 0 };

  for (let i = 0; i < entries.length; i++) {
    const entry    = entries[i];
    const prevHash = i === 0 ? GENESIS_PREV_HASH : entries[i - 1].entry_hash;

    // Check prev_hash linkage
    if (entry.prev_hash !== prevHash) {
      return { valid: false, length: entries.length, broken_at: entry.id };
    }

    // Recompute entry_hash
    const expected = computeEntryHash(
      entry.prev_hash,
      entry.agent_did_hash,
      entry.action_type,
      entry.outcome,
      entry.timestamp,
      entry.content_hash
    );

    if (expected !== entry.entry_hash) {
      return { valid: false, length: entries.length, broken_at: entry.id };
    }
  }

  return { valid: true, length: entries.length };
}

export interface ChainEntry {
  id: number;
  chain_id: number;
  entry_hash: string;
  prev_hash: string;
  agent_did_hash: string;
  action_type: string;
  outcome: string;
  timestamp: number;
  content_hash: string;
}

export interface ChainVerifyResult {
  valid: boolean;
  length: number;
  broken_at?: number;
}
