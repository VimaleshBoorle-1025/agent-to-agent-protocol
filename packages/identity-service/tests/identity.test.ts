import { FastifyInstance } from 'fastify';
import { generateKeyPair, verify as ed25519Verify, hashContent } from '@aap/crypto';

interface AAPCertResponse {
  version:            string;
  agent_did:          string;
  aap_address:        string;
  public_key_hex:     string;
  verification_level: string;
  issued_at:          string;
  expires_at:         string;
  issuer_did:         string;
  certificate_id:     string;
  signature:          string;
}

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockDb: { query: jest.Mock } = { query: jest.fn() };

jest.mock('../src/db/client', () => ({ db: mockDb }));

// ── Import app builder AFTER mock ────────────────────────────────────────────
import { buildApp } from '../src/index';

// ── Test-level issuer key pair ────────────────────────────────────────────────
const issuerKP  = generateKeyPair();
const agentKP   = generateKeyPair();
const TEST_DID  = 'did:aap:testagent001';
const AAP_ADDR  = 'aap://alice.human.chat';
const ISSUER_DID = 'did:aap:identity-service';

// Inject env before the app boots
process.env.IDENTITY_SERVICE_PRIVATE_KEY = issuerKP.privateKeyHex;
process.env.IDENTITY_SERVICE_DID         = ISSUER_DID;
process.env.IDENTITY_SERVICE_PUBLIC_KEY  = issuerKP.publicKeyHex;

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeCertRow(overrides: Record<string, unknown> = {}) {
  const now     = new Date();
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  return {
    id:                 'cert-uuid-1',
    agent_did:          TEST_DID,
    aap_address:        AAP_ADDR,
    public_key_hex:     agentKP.publicKeyHex,
    verification_level: 'personal_verified',
    issued_at:          now.toISOString(),
    expires_at:         expires.toISOString(),
    issuer_did:         ISSUER_DID,
    certificate_hash:   'deadbeef',
    signature:          'sigvalue',
    revoked:            false,
    revoked_at:         null,
    revoke_reason:      null,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────
describe('Identity Service', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockDb.query.mockReset();
  });

  // ── Health ──────────────────────────────────────────────────────────────────
  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  // ── Issue certificate ───────────────────────────────────────────────────────
  it('POST /v1/certificates/issue → 201 with valid certificate structure', async () => {
    // No existing cert
    mockDb.query
      .mockResolvedValueOnce({ rows: [] })           // SELECT (no duplicate)
      .mockResolvedValueOnce({ rows: [makeCertRow()] }); // INSERT RETURNING

    const res = await app.inject({
      method: 'POST',
      url:    '/v1/certificates/issue',
      payload: {
        agent_did:          TEST_DID,
        aap_address:        AAP_ADDR,
        public_key_hex:     agentKP.publicKeyHex,
        verification_level: 'personal_verified',
      },
    });

    expect(res.statusCode).toBe(201);
    const cert = res.json();
    expect(cert).toMatchObject({
      version:            '1.0',
      agent_did:          TEST_DID,
      aap_address:        AAP_ADDR,
      public_key_hex:     agentKP.publicKeyHex,
      verification_level: 'personal_verified',
      issuer_did:         ISSUER_DID,
    });
    expect(cert.certificate_id).toBeDefined();
    expect(cert.issued_at).toBeDefined();
    expect(cert.expires_at).toBeDefined();
    expect(cert.signature).toBeDefined();
  });

  // ── Certificate signature is verifiable ────────────────────────────────────
  it('POST /v1/certificates/issue → signature is verifiable with issuer public key', async () => {
    // Intercept the INSERT to return a row mirroring what was inserted
    mockDb.query
      .mockResolvedValueOnce({ rows: [] })           // no duplicate
      .mockImplementationOnce(async (_sql: string, params: unknown[]) => {
        const row = makeCertRow({
          id:               params[0],   // certId
          agent_did:        params[1],
          aap_address:      params[2],
          public_key_hex:   params[3],
          verification_level: params[4],
          issued_at:        params[5],
          expires_at:       params[6],
          issuer_did:       params[7],
          certificate_hash: params[8],
          signature:        params[9],
        });
        return { rows: [row] };
      });

    const res = await app.inject({
      method: 'POST',
      url:    '/v1/certificates/issue',
      payload: {
        agent_did:          TEST_DID,
        aap_address:        AAP_ADDR,
        public_key_hex:     agentKP.publicKeyHex,
        verification_level: 'personal_verified',
      },
    });

    expect(res.statusCode).toBe(201);
    const cert = res.json() as AAPCertResponse;

    // Re-derive hash using the SAME canonical field order the issuer used
    const canonicalPayload = {
      version:            cert.version,
      agent_did:          cert.agent_did,
      aap_address:        cert.aap_address,
      public_key_hex:     cert.public_key_hex,
      verification_level: cert.verification_level,
      issued_at:          cert.issued_at,
      expires_at:         cert.expires_at,
      issuer_did:         cert.issuer_did,
      certificate_id:     cert.certificate_id,
    };
    const hashHex   = hashContent(JSON.stringify(canonicalPayload));
    const hashBytes = new TextEncoder().encode(hashHex);
    const valid     = ed25519Verify(hashBytes, cert.signature, issuerKP.publicKeyHex);
    expect(valid).toBe(true);
  });

  // ── Get certificate by DID ──────────────────────────────────────────────────
  it('GET /v1/certificates/:did → 200 with certificate', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [makeCertRow()] });

    const res = await app.inject({
      method: 'GET',
      url:    `/v1/certificates/${encodeURIComponent(TEST_DID)}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ agent_did: TEST_DID });
  });

  it('GET /v1/certificates/:did → 404 when not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    const res = await app.inject({
      method: 'GET',
      url:    `/v1/certificates/${encodeURIComponent(TEST_DID)}`,
    });

    expect(res.statusCode).toBe(404);
  });

  // ── Verify valid certificate ────────────────────────────────────────────────
  it('GET /v1/certificates/:did/verify → { valid: true } for valid cert', async () => {
    // Build a real cert so signature verification works
    const now     = new Date();
    const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const certPayload = {
      version:            '1.0' as const,
      agent_did:          TEST_DID,
      aap_address:        AAP_ADDR,
      public_key_hex:     agentKP.publicKeyHex,
      verification_level: 'personal_verified',
      issued_at:          now.toISOString(),
      expires_at:         expires.toISOString(),
      issuer_did:         ISSUER_DID,
      certificate_id:     'cert-uuid-verify',
    };
    const hashHex   = hashContent(JSON.stringify(certPayload));
    const hashBytes = new TextEncoder().encode(hashHex);

    // Sign with issuer key
    const { sign } = await import('@aap/crypto');
    const sig = sign(hashBytes, issuerKP.privateKeyHex);

    mockDb.query.mockResolvedValueOnce({
      rows: [{
        ...certPayload,
        id:               'cert-uuid-verify',
        certificate_hash: hashHex,
        signature:        sig,
        revoked:          false,
        revoked_at:       null,
        revoke_reason:    null,
      }],
    });

    const res = await app.inject({
      method: 'GET',
      url:    `/v1/certificates/${encodeURIComponent(TEST_DID)}/verify`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ valid: true });
  });

  // ── Verify expired certificate ──────────────────────────────────────────────
  it('GET /v1/certificates/:did/verify → { valid: false, reason: "EXPIRED" }', async () => {
    const past = new Date(Date.now() - 1000); // 1 second ago
    mockDb.query.mockResolvedValueOnce({
      rows: [makeCertRow({ expires_at: past.toISOString(), revoked: false })],
    });

    const res = await app.inject({
      method: 'GET',
      url:    `/v1/certificates/${encodeURIComponent(TEST_DID)}/verify`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('EXPIRED');
  });

  // ── Revoke certificate ──────────────────────────────────────────────────────
  it('POST /v1/certificates/:did/revoke → 200', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [makeCertRow()] }) // SELECT existing
      .mockResolvedValueOnce({ rows: [] });              // UPDATE revoked

    const res = await app.inject({
      method: 'POST',
      url:    `/v1/certificates/${encodeURIComponent(TEST_DID)}/revoke`,
      payload: { reason: 'Key compromise' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ revoked: true });
  });

  it('POST /v1/certificates/:did/revoke → 404 when cert not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });

    const res = await app.inject({
      method: 'POST',
      url:    `/v1/certificates/${encodeURIComponent(TEST_DID)}/revoke`,
      payload: { reason: 'Key compromise' },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── Verify revoked certificate ──────────────────────────────────────────────
  it('GET /v1/certificates/:did/verify → { valid: false, reason: "REVOKED" }', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    mockDb.query.mockResolvedValueOnce({
      rows: [makeCertRow({ expires_at: future.toISOString(), revoked: true })],
    });

    const res = await app.inject({
      method: 'GET',
      url:    `/v1/certificates/${encodeURIComponent(TEST_DID)}/verify`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('REVOKED');
  });

  // ── Duplicate certificate ───────────────────────────────────────────────────
  it('POST /v1/certificates/issue → 409 when cert already exists', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [makeCertRow()] }); // existing cert found

    const res = await app.inject({
      method: 'POST',
      url:    '/v1/certificates/issue',
      payload: {
        agent_did:          TEST_DID,
        aap_address:        AAP_ADDR,
        public_key_hex:     agentKP.publicKeyHex,
        verification_level: 'personal_verified',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: expect.stringContaining('already') });
  });
});
