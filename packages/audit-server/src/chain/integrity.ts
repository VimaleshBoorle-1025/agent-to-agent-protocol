import { hashContent } from '@aap/crypto';

/**
 * The genesis sentinel: first entry in a chain has no predecessor.
 */
export const GENESIS_PREV_HASH = '0'.repeat(64);

/** Hash an agent DID for privacy-preserving storage in the audit chain. */
export function hashAgentDid(did: string): string {
  return hashContent(did);
}

/**
 * Compute a single audit chain entry hash.
 *
 * entry_hash = SHA256(
 *   prev_hash || agent_did_hash || action_type || outcome || timestamp || content_hash
 * )
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
  return hashContent(data);
}

export interface AuditEntry {
  id: number;
  chain_id: number;
  entry_hash: string;
  prev_hash: string;
  agent_did_hash: string;
  action_type: string;
  outcome: string;
  timestamp: number;
  content_hash: string;
  created_at?: string;
}

/** Alias for backward compatibility with tests that import ChainEntry */
export type ChainEntry = AuditEntry;

export interface VerifyResult {
  valid: boolean;
  length: number;
  broken_at?: number;
}

/**
 * Verify the integrity of all entries in a chain by recomputing every
 * entry_hash from scratch and confirming each prev_hash linkage.
 *
 * @param entries  All entries for the chain, sorted by id ASC.
 */
export function verifyChain(entries: AuditEntry[]): VerifyResult {
  if (entries.length === 0) {
    return { valid: true, length: 0 };
  }

  // First entry must reference the genesis sentinel
  let expectedPrev = GENESIS_PREV_HASH;

  for (const entry of entries) {
    // Check that prev_hash linkage is correct
    if (entry.prev_hash !== expectedPrev) {
      return { valid: false, length: entries.length, broken_at: entry.id };
    }

    // Recompute entry_hash from raw fields
    const recomputed = computeEntryHash(
      entry.prev_hash,
      entry.agent_did_hash,
      entry.action_type,
      entry.outcome,
      entry.timestamp,
      entry.content_hash
    );

    if (recomputed !== entry.entry_hash) {
      return { valid: false, length: entries.length, broken_at: entry.id };
    }

    expectedPrev = entry.entry_hash;
  }

  return { valid: true, length: entries.length };
}
