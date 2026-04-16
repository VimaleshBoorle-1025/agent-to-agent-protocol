import { buildApp } from '../src/app';
import { approvalQueue } from '../src/queue';
import { classifyRisk, classifyUnknownAction } from '../src/risk';

// ── Risk Classifier ──────────────────────────────────────────────────────────

describe('classifyRisk', () => {
  it('classifies PING as Category 1 (auto-approve)', () => {
    const r = classifyRisk('PING');
    expect(r.category).toBe(1);
    expect(r.auto_approve).toBe(true);
    expect(r.requires_block).toBe(false);
  });

  it('classifies READ_BANK_BALANCE as Category 2 (notify, no block)', () => {
    const r = classifyRisk('READ_BANK_BALANCE');
    expect(r.category).toBe(2);
    expect(r.requires_block).toBe(false);
    expect(r.auto_approve).toBe(true);
  });

  it('escalates READ_BANK_BALANCE to Category 3 when amount > 10k', () => {
    const r = classifyRisk('READ_BANK_BALANCE', { amount: 15000 });
    expect(r.category).toBe(3);
    expect(r.requires_block).toBe(true);
  });

  it('classifies INITIATE_PAYMENT as Category 3 (block, no MFA)', () => {
    const r = classifyRisk('INITIATE_PAYMENT');
    expect(r.category).toBe(3);
    expect(r.requires_block).toBe(true);
    expect(r.requires_mfa).toBe(false);
  });

  it('classifies TRANSFER_FUNDS as Category 4 (block + MFA)', () => {
    const r = classifyRisk('TRANSFER_FUNDS');
    expect(r.category).toBe(4);
    expect(r.requires_block).toBe(true);
    expect(r.requires_mfa).toBe(true);
  });

  it('classifies SIGN_CONTRACT as Category 4', () => {
    const r = classifyRisk('SIGN_CONTRACT');
    expect(r.category).toBe(4);
  });

  it('defaults unknown actions to Category 3', () => {
    const r = classifyUnknownAction('SOME_NEW_ACTION');
    expect(r.category).toBe(3);
    expect(r.requires_block).toBe(true);
  });
});

// ── Approval Queue ────────────────────────────────────────────────────────────

describe('approvalQueue', () => {
  beforeEach(() => approvalQueue._flush());

  it('enqueues a request with pending status', () => {
    const risk = classifyRisk('INITIATE_PAYMENT');
    const req  = approvalQueue.enqueue('did:aap:test', 'INITIATE_PAYMENT', {}, risk);
    expect(req.status).toBe('pending');
    expect(req.approval_id).toBeDefined();
  });

  it('resolves to approved', () => {
    const risk = classifyRisk('INITIATE_PAYMENT');
    const req  = approvalQueue.enqueue('did:aap:test', 'INITIATE_PAYMENT', {}, risk);
    const resolved = approvalQueue.resolve(req.approval_id, 'approved', 'human@test.com');
    expect(resolved?.status).toBe('approved');
    expect(resolved?.approved_by).toBe('human@test.com');
  });

  it('resolves to rejected', () => {
    const risk = classifyRisk('INITIATE_PAYMENT');
    const req  = approvalQueue.enqueue('did:aap:test', 'INITIATE_PAYMENT', {}, risk);
    const resolved = approvalQueue.resolve(req.approval_id, 'rejected', 'human@test.com');
    expect(resolved?.status).toBe('rejected');
  });

  it('returns null when resolving non-existent approval', () => {
    const result = approvalQueue.resolve('nonexistent', 'approved', 'human@test.com');
    expect(result).toBeNull();
  });

  it('lists only pending approvals', () => {
    const risk = classifyRisk('INITIATE_PAYMENT');
    const r1 = approvalQueue.enqueue('did:aap:a', 'INITIATE_PAYMENT', {}, risk);
    const r2 = approvalQueue.enqueue('did:aap:b', 'INITIATE_PAYMENT', {}, risk);
    approvalQueue.resolve(r1.approval_id, 'approved', 'human');

    const pending = approvalQueue.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].approval_id).toBe(r2.approval_id);
  });

  it('notifies subscribers on enqueue', (done) => {
    const risk = classifyRisk('INITIATE_PAYMENT');
    approvalQueue.subscribe((req) => {
      expect(req.action_type).toBe('INITIATE_PAYMENT');
      done();
    });
    approvalQueue.enqueue('did:aap:sub', 'INITIATE_PAYMENT', {}, risk);
  });
});

// ── HTTP API ──────────────────────────────────────────────────────────────────

describe('Human Auth API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => { app = await buildApp({ testMode: true }); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => approvalQueue._flush());

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('ok');
  });

  it('POST /v1/authorize auto-approves Category 1 (PING)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/authorize',
      payload: { agent_did: 'did:aap:test', action_type: 'PING' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('approved');
    expect(body.category).toBe(1);
  });

  it('POST /v1/authorize auto-approves Category 2 (READ_BANK_BALANCE)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/authorize',
      payload: { agent_did: 'did:aap:test', action_type: 'READ_BANK_BALANCE', params: { amount: 100 } },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).category).toBe(2);
  });

  it('GET /v1/authorize/pending lists pending requests', async () => {
    const risk = classifyRisk('INITIATE_PAYMENT');
    approvalQueue.enqueue('did:aap:x', 'INITIATE_PAYMENT', {}, risk);

    const res = await app.inject({ method: 'GET', url: '/v1/authorize/pending' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).pending).toHaveLength(1);
  });

  it('POST /v1/authorize/:id/approve resolves a pending request', async () => {
    const risk = classifyRisk('INITIATE_PAYMENT');
    const req  = approvalQueue.enqueue('did:aap:y', 'INITIATE_PAYMENT', {}, risk);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/authorize/${req.approval_id}/approve`,
      payload: { approved_by: 'alice@test.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('approved');
  });

  it('POST /v1/authorize/:id/approve requires MFA for Category 4', async () => {
    const risk = classifyRisk('TRANSFER_FUNDS');
    const req  = approvalQueue.enqueue('did:aap:z', 'TRANSFER_FUNDS', {}, risk);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/authorize/${req.approval_id}/approve`,
      payload: { approved_by: 'alice@test.com' }, // no mfa_token
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('MFA_REQUIRED');
  });

  it('POST /v1/authorize/:id/approve with MFA succeeds for Category 4', async () => {
    const risk = classifyRisk('TRANSFER_FUNDS');
    const req  = approvalQueue.enqueue('did:aap:z2', 'TRANSFER_FUNDS', {}, risk);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/authorize/${req.approval_id}/approve`,
      payload: { approved_by: 'alice@test.com', mfa_token: '123456' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /v1/authorize/:id/reject rejects a pending request', async () => {
    const risk = classifyRisk('INITIATE_PAYMENT');
    const req  = approvalQueue.enqueue('did:aap:w', 'INITIATE_PAYMENT', {}, risk);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/authorize/${req.approval_id}/reject`,
      payload: { rejected_by: 'bob@test.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('rejected');
  });
});
