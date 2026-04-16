/**
 * Validates the aap:// address format.
 * Expected: aap://[owner].[type].[capability]
 * Examples: aap://vimalesh.finance.manager, aap://chase.bank.payments
 */
export function validateAAPAddress(address: string): boolean {
  const pattern = /^aap:\/\/[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/;
  return pattern.test(address);
}

/**
 * Checks that a nonce has not been used before and registers it.
 * Returns false if the nonce was already seen (replay attack).
 */
export async function checkAndStoreNonce(
  nonce: string,
  db: any
): Promise<boolean> {
  try {
    await db.query('INSERT INTO used_nonces (nonce) VALUES ($1)', [nonce]);
    return true;
  } catch {
    // Unique constraint violation — nonce already used
    return false;
  }
}

/**
 * Validates that the message timestamp is within the 30-second window.
 */
export function validateTimestamp(timestamp: number): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff <= 30_000;
}
