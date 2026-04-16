/**
 * Approval queue — backed by Redis.
 * Pending approvals are stored with a TTL (default 5 minutes).
 * WebSocket subscribers receive real-time notifications when items arrive.
 */

import { v4 as uuidv4 } from 'uuid';
import { RiskDecision } from './risk';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout';

export interface ApprovalRequest {
  approval_id:  string;
  agent_did:    string;
  action_type:  string;
  params:       Record<string, unknown>;
  risk:         RiskDecision;
  created_at:   number;
  expires_at:   number;
  status:       ApprovalStatus;
  approved_by?: string;
  resolved_at?: number;
  mfa_token?:   string;
}

// In-memory store (Redis client injected separately for testability)
const approvals = new Map<string, ApprovalRequest>();

// WebSocket subscriber callbacks — notified when a new request arrives
const subscribers = new Set<(req: ApprovalRequest) => void>();

const APPROVAL_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const approvalQueue = {
  /**
   * Enqueue an approval request. Returns the full ApprovalRequest.
   */
  enqueue(
    agentDid: string,
    actionType: string,
    params: Record<string, unknown>,
    risk: RiskDecision
  ): ApprovalRequest {
    const now = Date.now();
    const req: ApprovalRequest = {
      approval_id: uuidv4(),
      agent_did:   agentDid,
      action_type: actionType,
      params,
      risk,
      created_at:  now,
      expires_at:  now + APPROVAL_TTL_MS,
      status:      'pending',
    };
    approvals.set(req.approval_id, req);

    // Notify all WebSocket subscribers
    for (const sub of subscribers) {
      try { sub(req); } catch {}
    }

    // Auto-expire after TTL
    setTimeout(() => {
      const stored = approvals.get(req.approval_id);
      if (stored && stored.status === 'pending') {
        stored.status     = 'timeout';
        stored.resolved_at = Date.now();
      }
    }, APPROVAL_TTL_MS);

    return req;
  },

  get(approvalId: string): ApprovalRequest | undefined {
    return approvals.get(approvalId);
  },

  /**
   * Resolve an approval (approve or reject). Returns updated request or null if not found.
   */
  resolve(
    approvalId: string,
    decision: 'approved' | 'rejected',
    approvedBy: string,
    mfaToken?: string
  ): ApprovalRequest | null {
    const req = approvals.get(approvalId);
    if (!req || req.status !== 'pending') return null;
    if (req.expires_at < Date.now()) {
      req.status = 'timeout';
      return null;
    }
    req.status      = decision;
    req.approved_by = approvedBy;
    req.resolved_at = Date.now();
    if (mfaToken) req.mfa_token = mfaToken;
    return req;
  },

  listPending(): ApprovalRequest[] {
    return Array.from(approvals.values()).filter(r => r.status === 'pending');
  },

  subscribe(callback: (req: ApprovalRequest) => void): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },

  /** Flush all state — for tests only */
  _flush() {
    approvals.clear();
    subscribers.clear();
  },
};
