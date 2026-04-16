/**
 * Risk tier classifier — determines which Category (1-4) an action falls into.
 *
 * Category 1 — Auto-approved, no human needed
 *   Examples: PING, REQUEST_DATA, status checks
 *
 * Category 2 — Notify human but don't block (async audit)
 *   Examples: READ_BANK_BALANCE, REQUEST_QUOTE
 *
 * Category 3 — Block until human approves (timeout = APPROVE_TIMEOUT_MS)
 *   Examples: INITIATE_PAYMENT, REQUEST_ACCESS
 *
 * Category 4 — Block + require explicit human input with MFA
 *   Examples: TRANSFER_FUNDS, SIGN_CONTRACT, GRANT_PERMISSION
 */

export type RiskCategory = 1 | 2 | 3 | 4;

export interface RiskDecision {
  category:       RiskCategory;
  requires_block: boolean;   // false = pass through, true = block until approved
  requires_mfa:   boolean;
  reason:         string;
  auto_approve:   boolean;
}

const CATEGORY_1_ACTIONS = new Set([
  'PING', 'REQUEST_DATA', 'RETURN_DATA', 'PONG',
  'HANDSHAKE_INIT', 'HANDSHAKE_RESPONSE', 'DISCONNECT',
  'REQUEST_SCHEMA', 'RETURN_SCHEMA',
]);

const CATEGORY_2_ACTIONS = new Set([
  'READ_BANK_BALANCE', 'REQUEST_QUOTE', 'RETURN_QUOTE',
  'READ_EMAIL', 'READ_CALENDAR', 'REQUEST_CAPABILITIES',
  'AUDIT_LOG',
]);

const CATEGORY_3_ACTIONS = new Set([
  'INITIATE_PAYMENT', 'REQUEST_ACCESS', 'WRITE_EMAIL',
  'WRITE_CALENDAR', 'MODIFY_RECORD', 'SCHEDULE_TASK',
]);

const CATEGORY_4_ACTIONS = new Set([
  'TRANSFER_FUNDS', 'SIGN_CONTRACT', 'GRANT_PERMISSION',
  'REVOKE_PERMISSION', 'DELETE_RECORD', 'EXECUTE_TRADE',
  'CREATE_ACCOUNT', 'CLOSE_ACCOUNT',
]);

export function classifyRisk(
  actionType: string,
  params: Record<string, unknown> = {}
): RiskDecision {
  // Category 4 — highest risk
  if (CATEGORY_4_ACTIONS.has(actionType)) {
    return {
      category:       4,
      requires_block: true,
      requires_mfa:   true,
      reason:         `${actionType} is a high-risk irreversible action requiring MFA approval`,
      auto_approve:   false,
    };
  }

  // Category 3 — needs human sign-off
  if (CATEGORY_3_ACTIONS.has(actionType)) {
    return {
      category:       3,
      requires_block: true,
      requires_mfa:   false,
      reason:         `${actionType} requires explicit human approval`,
      auto_approve:   false,
    };
  }

  // Category 2 — notify but don't block
  if (CATEGORY_2_ACTIONS.has(actionType)) {
    // Escalate to Category 3 if amount exceeds threshold
    const amount = typeof params.amount === 'number' ? params.amount : 0;
    if (amount > 10_000) {
      return {
        category:       3,
        requires_block: true,
        requires_mfa:   false,
        reason:         `Amount ${amount} exceeds auto-approve threshold for ${actionType}`,
        auto_approve:   false,
      };
    }
    return {
      category:       2,
      requires_block: false,
      requires_mfa:   false,
      reason:         `${actionType} is informational — logging without blocking`,
      auto_approve:   true,
    };
  }

  // Category 1 — auto-approve
  return {
    category:       1,
    requires_block: false,
    requires_mfa:   false,
    reason:         `${actionType} is a read-only/control action — auto-approved`,
    auto_approve:   true,
  };
}

// Unknown actions default to Category 3 (block until approved)
export function classifyUnknownAction(actionType: string): RiskDecision {
  return {
    category:       3,
    requires_block: true,
    requires_mfa:   false,
    reason:         `Unknown action ${actionType} — blocked pending human review`,
    auto_approve:   false,
  };
}
