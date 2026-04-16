import { v4 as uuidv4 } from 'uuid';
import { sign, verify as ed25519Verify, hashContent } from '@aap/crypto';
import { db } from '../db/client';

export type VerificationLevel =
  | 'unverified'
  | 'personal_verified'
  | 'business_verified'
  | 'enterprise';

export interface AAPCertificate {
  version:            '1.0';
  agent_did:          string;
  aap_address:        string;
  public_key_hex:     string;
  verification_level: VerificationLevel;
  issued_at:          string;
  expires_at:         string;
  issuer_did:         string;
  certificate_id:     string;
  signature:          string;
}

interface IssueParams {
  agent_did:          string;
  aap_address:        string;
  public_key_hex:     string;
  verification_level: VerificationLevel;
}

function getIssuerPrivateKey(): string {
  const key = process.env.IDENTITY_SERVICE_PRIVATE_KEY;
  if (!key) throw new Error('IDENTITY_SERVICE_PRIVATE_KEY is not set');
  return key;
}

function getIssuerDid(): string {
  const did = process.env.IDENTITY_SERVICE_DID;
  if (!did) throw new Error('IDENTITY_SERVICE_DID is not set');
  return did;
}

function getIssuerPublicKey(): string {
  const key = process.env.IDENTITY_SERVICE_PUBLIC_KEY;
  if (!key) throw new Error('IDENTITY_SERVICE_PUBLIC_KEY is not set');
  return key;
}

export async function issueCertificate(params: IssueParams): Promise<AAPCertificate> {
  const { agent_did, aap_address, public_key_hex, verification_level } = params;

  // Check for existing certificate
  const existing = await db.query(
    'SELECT id FROM certificates WHERE agent_did = $1',
    [agent_did]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('Certificate already exists for this agent'), { statusCode: 409 });
  }

  const now      = new Date();
  const expires  = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const certId   = uuidv4();
  const issuerDid = getIssuerDid();

  // Build cert payload WITHOUT signature
  const certPayload = {
    version:            '1.0' as const,
    agent_did,
    aap_address,
    public_key_hex,
    verification_level,
    issued_at:          now.toISOString(),
    expires_at:         expires.toISOString(),
    issuer_did:         issuerDid,
    certificate_id:     certId,
  };

  // Compute hash then sign
  const hashHex   = hashContent(JSON.stringify(certPayload));
  const hashBytes = new TextEncoder().encode(hashHex);
  const signature = sign(hashBytes, getIssuerPrivateKey());

  const result = await db.query(
    `INSERT INTO certificates
       (id, agent_did, aap_address, public_key_hex, verification_level,
        issued_at, expires_at, issuer_did, certificate_hash, signature)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      certId,
      agent_did,
      aap_address,
      public_key_hex,
      verification_level,
      now.toISOString(),
      expires.toISOString(),
      issuerDid,
      hashHex,
      signature,
    ]
  );

  const row = result.rows[0];
  return rowToCert(row, signature);
}

export async function getCertificate(agentDid: string): Promise<AAPCertificate | null> {
  const result = await db.query(
    'SELECT * FROM certificates WHERE agent_did = $1',
    [agentDid]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return rowToCert(row, row.signature);
}

export interface VerifyResult {
  valid:   boolean;
  reason?: string;
}

export async function verifyCertificate(agentDid: string): Promise<VerifyResult> {
  const result = await db.query(
    'SELECT * FROM certificates WHERE agent_did = $1',
    [agentDid]
  );
  if (result.rows.length === 0) {
    return { valid: false, reason: 'NOT_FOUND' };
  }
  const row = result.rows[0];

  // Check revocation first
  if (row.revoked) {
    return { valid: false, reason: 'REVOKED' };
  }

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    return { valid: false, reason: 'EXPIRED' };
  }

  // Verify signature
  const certPayload = {
    version:            '1.0' as const,
    agent_did:          row.agent_did,
    aap_address:        row.aap_address,
    public_key_hex:     row.public_key_hex,
    verification_level: row.verification_level,
    issued_at:          new Date(row.issued_at).toISOString(),
    expires_at:         new Date(row.expires_at).toISOString(),
    issuer_did:         row.issuer_did,
    certificate_id:     row.id,
  };
  const hashHex   = hashContent(JSON.stringify(certPayload));
  const hashBytes = new TextEncoder().encode(hashHex);
  const sigValid  = ed25519Verify(hashBytes, row.signature, getIssuerPublicKey());
  if (!sigValid) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  return { valid: true };
}

export async function revokeCertificate(
  agentDid: string,
  reason?: string
): Promise<{ revoked: boolean }> {
  const existing = await db.query(
    'SELECT id FROM certificates WHERE agent_did = $1',
    [agentDid]
  );
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Certificate not found'), { statusCode: 404 });
  }

  await db.query(
    `UPDATE certificates
     SET revoked = true, revoked_at = NOW(), revoke_reason = $1
     WHERE agent_did = $2`,
    [reason ?? null, agentDid]
  );

  return { revoked: true };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowToCert(row: Record<string, unknown>, signature: string): AAPCertificate {
  return {
    version:            '1.0',
    agent_did:          row.agent_did as string,
    aap_address:        row.aap_address as string,
    public_key_hex:     row.public_key_hex as string,
    verification_level: row.verification_level as VerificationLevel,
    issued_at:          new Date(row.issued_at as string).toISOString(),
    expires_at:         new Date(row.expires_at as string).toISOString(),
    issuer_did:         row.issuer_did as string,
    certificate_id:     (row.id ?? row.certificate_id) as string,
    signature,
  };
}
