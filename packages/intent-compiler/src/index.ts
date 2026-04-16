/**
 * AAP Intent Compiler
 *
 * The critical security boundary between the AI brain and the AAP protocol.
 * This is DETERMINISTIC CODE — NOT AI. Cannot be manipulated via prompt injection.
 *
 * The AI brain NEVER directly touches the network, crypto, or protocol.
 * Only valid typed actions within the agent's capability manifest reach the protocol layer.
 */

import { ACTION_REGISTRY, ACTION_SCHEMAS, ActionType } from './action-registry';

export interface CapabilityManifest {
  agent_did: string;
  level: number;
  allowed_actions: ActionType[];
  denied_actions: ActionType[];
  allowed_data_types: string[];
  denied_data_types: string[];
  approved_agents: string[];
  expires_at: string;
}

export interface CompileResult {
  success: boolean;
  message?: Record<string, unknown>;
  error?: string;
  requires_human_auth?: boolean;
}

export class IntentCompiler {
  /**
   * Process AI output through the security boundary.
   * Returns a clean typed AAP message or an error.
   */
  static process(
    ai_output: unknown,
    manifest: CapabilityManifest,
    target_agent_did?: string
  ): CompileResult {
    // Step 1: Parse AI output as JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = typeof ai_output === 'string'
        ? JSON.parse(ai_output)
        : (ai_output as Record<string, unknown>);
    } catch {
      return { success: false, error: 'INVALID_JSON: AI output must be valid JSON' };
    }

    // Step 2: Extract action_type
    const action_type = parsed['action_type'] as string;
    if (!action_type) {
      return { success: false, error: 'MISSING_ACTION_TYPE' };
    }
    if (!ACTION_REGISTRY.has(action_type as ActionType)) {
      return { success: false, error: `UNKNOWN_ACTION: ${action_type} is not in the AAP Action Registry` };
    }

    const typedAction = action_type as ActionType;

    // Step 3: Check against capability manifest
    if (manifest.denied_actions.includes(typedAction)) {
      return { success: false, error: `ACTION_DENIED: ${typedAction} is explicitly denied in capability manifest` };
    }
    if (!manifest.allowed_actions.includes(typedAction)) {
      return { success: false, error: `ACTION_NOT_ALLOWED: ${typedAction} is not in allowed_actions` };
    }

    // Step 4: Validate required fields, strip unknown fields
    const requiredFields = ACTION_SCHEMAS[typedAction];
    const clean: Record<string, unknown> = { action_type: typedAction };

    for (const field of requiredFields) {
      if (parsed[field] === undefined || parsed[field] === null) {
        return { success: false, error: `MISSING_FIELD: required field '${field}' not found` };
      }
      // Reject natural language strings in parameter values (basic check)
      if (typeof parsed[field] === 'string' && this.isNaturalLanguage(parsed[field] as string)) {
        return { success: false, error: `NATURAL_LANGUAGE_DETECTED: field '${field}' contains free-form text` };
      }
      clean[field] = parsed[field];
    }

    // Step 5: Check data types
    if (parsed['data_type']) {
      const dataType = parsed['data_type'] as string;
      if (manifest.denied_data_types.includes(dataType)) {
        return { success: false, error: `DATA_TYPE_DENIED: ${dataType} is denied in capability manifest` };
      }
      if (!manifest.allowed_data_types.includes(dataType)) {
        return { success: false, error: `DATA_TYPE_NOT_ALLOWED: ${dataType} is not in allowed_data_types` };
      }
    }

    // Step 6: Check target agent approval
    if (target_agent_did && manifest.approved_agents.length > 0) {
      const approved = manifest.approved_agents.some((pattern) =>
        this.matchAgentPattern(target_agent_did, pattern)
      );
      if (!approved) {
        return {
          success: false,
          error: `UNAPPROVED_AGENT: ${target_agent_did} is not in approved_agents list`,
          requires_human_auth: true,
        };
      }
    }

    // Step 7: Check manifest expiry
    if (new Date(manifest.expires_at) < new Date()) {
      return { success: false, error: 'MANIFEST_EXPIRED: capability manifest has expired' };
    }

    return { success: true, message: clean };
  }

  /**
   * Detect if a string looks like natural language (heuristic).
   * Natural language in protocol fields is a security risk.
   */
  private static isNaturalLanguage(value: string): boolean {
    // Flag if it contains spaces and looks like a sentence
    const wordCount = value.trim().split(/\s+/).length;
    return wordCount > 4 && /[a-zA-Z]/.test(value);
  }

  /**
   * Match agent DID against an approved pattern (supports wildcards like did:aap:chase.bank.*)
   */
  private static matchAgentPattern(did: string, pattern: string): boolean {
    if (pattern.endsWith('*')) {
      return did.startsWith(pattern.slice(0, -1));
    }
    return did === pattern;
  }
}

export { ActionType, ACTION_REGISTRY, ACTION_SCHEMAS };
