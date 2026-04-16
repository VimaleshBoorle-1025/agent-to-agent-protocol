import { FastifyInstance } from 'fastify';
import { classifyRisk, classifyUnknownAction } from '../risk';
import { approvalQueue } from '../queue';

const ACTION_TYPES = new Set([
  'PING', 'REQUEST_DATA', 'RETURN_DATA', 'PONG',
  'HANDSHAKE_INIT', 'HANDSHAKE_RESPONSE', 'DISCONNECT',
  'REQUEST_SCHEMA', 'RETURN_SCHEMA', 'READ_BANK_BALANCE',
  'REQUEST_QUOTE', 'RETURN_QUOTE', 'READ_EMAIL', 'READ_CALENDAR',
  'REQUEST_CAPABILITIES', 'AUDIT_LOG', 'INITIATE_PAYMENT',
  'REQUEST_ACCESS', 'WRITE_EMAIL', 'WRITE_CALENDAR',
  'MODIFY_RECORD', 'SCHEDULE_TASK', 'TRANSFER_FUNDS',
  'SIGN_CONTRACT', 'GRANT_PERMISSION', 'REVOKE_PERMISSION',
  'DELETE_RECORD', 'EXECUTE_TRADE', 'CREATE_ACCOUNT', 'CLOSE_ACCOUNT',
]);

const APPROVE_TIMEOUT_MS = parseInt(process.env.APPROVE_TIMEOUT_MS ?? '300000', 10);

export async function authorizeRoutes(app: FastifyInstance) {
  /**
   * POST /v1/authorize
   * Called by any AAP service before executing a Category 3/4 action.
   * Returns immediately for Cat 1/2. Blocks (long-poll) for Cat 3/4.
   */
  app.post<{
    Body: {
      agent_did: string;
      action_type: string;
      params?: Record<string, unknown>;
    };
  }>('/v1/authorize', {
    schema: {
      body: {
        type: 'object',
        required: ['agent_did', 'action_type'],
        properties: {
          agent_did:   { type: 'string', minLength: 1 },
          action_type: { type: 'string', minLength: 1 },
          params:      { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const { agent_did, action_type, params = {} } = req.body;

    const risk = ACTION_TYPES.has(action_type)
      ? classifyRisk(action_type, params)
      : classifyUnknownAction(action_type);

    // Cat 1 — pass straight through
    if (risk.category === 1) {
      return reply.send({ status: 'approved', category: 1, risk });
    }

    // Cat 2 — log and pass through
    if (risk.category === 2) {
      const req2 = approvalQueue.enqueue(agent_did, action_type, params, risk);
      // Immediately resolve as approved (audit only)
      approvalQueue.resolve(req2.approval_id, 'approved', 'system:auto');
      return reply.send({ status: 'approved', category: 2, approval_id: req2.approval_id, risk });
    }

    // Cat 3/4 — enqueue and long-poll until resolved or timeout
    const approval = approvalQueue.enqueue(agent_did, action_type, params, risk);

    const resolved = await new Promise<'approved' | 'rejected' | 'timeout'>((resolve) => {
      const deadline = setTimeout(() => resolve('timeout'), APPROVE_TIMEOUT_MS);

      const interval = setInterval(() => {
        const current = approvalQueue.get(approval.approval_id);
        if (current && current.status !== 'pending') {
          clearTimeout(deadline);
          clearInterval(interval);
          resolve(current.status as 'approved' | 'rejected' | 'timeout');
        }
      }, 1_000);
    });

    const current = approvalQueue.get(approval.approval_id);
    if (resolved === 'approved') {
      return reply.send({ status: 'approved', category: risk.category, approval_id: approval.approval_id, risk });
    }
    reply.status(403).send({
      status: resolved,
      category: risk.category,
      approval_id: approval.approval_id,
      risk,
    });
  });

  /**
   * GET /v1/authorize/pending
   * Returns all pending approval requests (human operator dashboard).
   */
  app.get('/v1/authorize/pending', async (_req, reply) => {
    reply.send({ pending: approvalQueue.listPending() });
  });

  /**
   * POST /v1/authorize/:id/approve
   * Human operator approves a pending request.
   */
  app.post<{
    Params: { id: string };
    Body: { approved_by: string; mfa_token?: string };
  }>('/v1/authorize/:id/approve', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['approved_by'],
        properties: {
          approved_by: { type: 'string', minLength: 1 },
          mfa_token:   { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { approved_by, mfa_token } = req.body;

    const approval = approvalQueue.get(id);
    if (!approval) return reply.status(404).send({ error: 'APPROVAL_NOT_FOUND' });

    // Category 4 requires MFA token
    if (approval.risk.category === 4 && !mfa_token) {
      return reply.status(400).send({ error: 'MFA_REQUIRED', message: 'Category 4 actions require an MFA token' });
    }

    const resolved = approvalQueue.resolve(id, 'approved', approved_by, mfa_token);
    if (!resolved) return reply.status(409).send({ error: 'ALREADY_RESOLVED_OR_EXPIRED' });

    reply.send({ status: 'approved', approval_id: id, approved_by });
  });

  /**
   * POST /v1/authorize/:id/reject
   */
  app.post<{
    Params: { id: string };
    Body: { rejected_by: string; reason?: string };
  }>('/v1/authorize/:id/reject', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        required: ['rejected_by'],
        properties: {
          rejected_by: { type: 'string', minLength: 1 },
          reason:      { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params;
    const { rejected_by } = req.body;

    const resolved = approvalQueue.resolve(id, 'rejected', rejected_by);
    if (!resolved) return reply.status(404).send({ error: 'NOT_FOUND_OR_EXPIRED' });

    reply.send({ status: 'rejected', approval_id: id, rejected_by });
  });
}
