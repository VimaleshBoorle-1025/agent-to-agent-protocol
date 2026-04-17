import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ─── Config ───────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID     || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const JWT_SECRET           = process.env.JWT_SECRET           || crypto.randomBytes(32).toString('hex');
const FRONTEND_URL         = process.env.FRONTEND_URL         || 'https://synapse-pink.vercel.app';
const RESEND_API_KEY       = process.env.RESEND_API_KEY       || '';
const OTP_TTL_MINUTES      = 10;

// ─── DB setup ─────────────────────────────────────────────────────────────────

async function ensureAuthTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_otps (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT NOT NULL,
      otp        TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS synapse_users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT UNIQUE NOT NULL,
      name          TEXT,
      handle        TEXT,
      did           TEXT,
      aap_address   TEXT,
      public_key_hex TEXT,
      auth_provider TEXT DEFAULT 'email',
      provider_id   TEXT,
      avatar_url    TEXT,
      registered_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_auth_otps_email ON auth_otps(email);
    CREATE INDEX IF NOT EXISTS idx_synapse_users_handle ON synapse_users(handle);
  `);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(user: {
  id: string; email: string; name?: string | null;
  handle?: string | null; did?: string | null;
  is_new?: boolean;
}): string {
  return jwt.sign({
    sub:    user.id,
    email:  user.email,
    name:   user.name  ?? '',
    handle: user.handle ?? '',
    did:    user.did    ?? '',
    is_new: user.is_new ?? false,
  }, JWT_SECRET, { expiresIn: '30d' });
}

async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  // Dev fallback: print to console so user can check Railway logs
  if (!RESEND_API_KEY) {
    console.log(`\n[SYNAPSE AUTH] OTP for ${email} → ${otp}\n`);
    return true;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'Synapse <noreply@synapse.network>',
        to:      email,
        subject: `${otp} — your Synapse verification code`,
        html:    `
          <div style="font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;background:#000;color:#fff;padding:40px;border-radius:12px;border:1px solid #1a1a1a">
            <div style="font-size:22px;font-weight:700;margin-bottom:8px">Synapse</div>
            <p style="color:#888;margin-bottom:32px;font-size:14px">Agent collaboration network</p>
            <p style="font-size:15px;margin-bottom:8px">Your verification code is:</p>
            <div style="font-size:40px;font-weight:700;letter-spacing:10px;margin:16px 0 24px">${otp}</div>
            <p style="color:#555;font-size:13px">Expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, ignore this email.</p>
          </div>`,
      }),
    });
    return r.ok;
  } catch (e) {
    console.error('[AUTH] Email send failed', e);
    return false;
  }
}

async function findOrCreateUser(email: string, name: string, provider: string, providerId: string, avatarUrl?: string) {
  // Try to find existing user
  const existing = await db.query(
    'SELECT * FROM synapse_users WHERE email = $1', [email]
  );
  if (existing.rows.length > 0) {
    // Update name/avatar if they came in fresh from OAuth
    if (name || avatarUrl) {
      await db.query(
        'UPDATE synapse_users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url) WHERE email = $3',
        [name || null, avatarUrl || null, email]
      );
    }
    return { ...existing.rows[0], is_new: false };
  }
  // Create new user
  const r = await db.query(
    `INSERT INTO synapse_users (email, name, auth_provider, provider_id, avatar_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [email, name || email.split('@')[0], provider, providerId, avatarUrl || null]
  );
  return { ...r.rows[0], is_new: true };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  await ensureAuthTables();

  // ── Email OTP: send ─────────────────────────────────────────────────────────
  app.post<{ Body: { email: string } }>('/auth/email/send', {
    schema: { body: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } } },
  }, async (req, reply) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) return reply.code(400).send({ error: 'Invalid email' });

    // Invalidate old OTPs for this email
    await db.query('UPDATE auth_otps SET used = TRUE WHERE email = $1 AND used = FALSE', [email]);

    const otp = makeOTP();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await db.query(
      'INSERT INTO auth_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
      [email, otp, expiresAt]
    );

    const sent = await sendOTPEmail(email, otp);
    return reply.send({ sent, demo: !RESEND_API_KEY });
  });

  // ── Email OTP: verify ───────────────────────────────────────────────────────
  app.post<{ Body: { email: string; otp: string; name?: string; handle?: string } }>('/auth/email/verify', {
    schema: { body: { type: 'object', required: ['email', 'otp'], properties: { email: { type: 'string' }, otp: { type: 'string' }, name: { type: 'string' }, handle: { type: 'string' } } } },
  }, async (req, reply) => {
    const { email, otp, name, handle } = req.body;

    const result = await db.query(
      `SELECT * FROM auth_otps WHERE email = $1 AND otp = $2 AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
      [email, otp]
    );
    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Invalid or expired code' });
    }

    // Mark OTP as used
    await db.query('UPDATE auth_otps SET used = TRUE WHERE id = $1', [result.rows[0].id]);

    const user = await findOrCreateUser(email, name ?? '', 'email', email);

    // If handle provided (from onboarding), update user
    if (handle && !user.handle) {
      await db.query('UPDATE synapse_users SET handle = $1, aap_address = $2 WHERE id = $3',
        [handle, `aap://${handle}`, user.id]);
      user.handle = handle;
      user.aap_address = `aap://${handle}`;
    }

    const token = signToken(user);
    return reply.send({ token, user, is_new: user.is_new });
  });

  // ── Update agent DID after onboarding ───────────────────────────────────────
  app.post<{ Body: { token: string; handle: string; did: string; public_key_hex: string } }>('/auth/link-agent', {
    schema: { body: { type: 'object', required: ['token', 'handle', 'did', 'public_key_hex'], properties: { token: { type: 'string' }, handle: { type: 'string' }, did: { type: 'string' }, public_key_hex: { type: 'string' } } } },
  }, async (req, reply) => {
    const { token, handle, did, public_key_hex } = req.body;
    let payload: jwt.JwtPayload;
    try { payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload; }
    catch { return reply.code(401).send({ error: 'Invalid token' }); }

    await db.query(
      `UPDATE synapse_users SET handle = $1, aap_address = $2, did = $3, public_key_hex = $4 WHERE id = $5`,
      [handle, `aap://${handle}`, did, public_key_hex, payload.sub]
    );
    const updated = await db.query('SELECT * FROM synapse_users WHERE id = $1', [payload.sub]);
    const newToken = signToken({ ...updated.rows[0], is_new: false });
    return reply.send({ token: newToken, user: updated.rows[0] });
  });

  // ── Google OAuth: initiate ──────────────────────────────────────────────────
  app.get('/auth/google', async (req, reply) => {
    if (!GOOGLE_CLIENT_ID) {
      return reply.redirect(`${FRONTEND_URL}?auth_error=google_not_configured`);
    }
    const params = new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  `${process.env.REGISTRY_PUBLIC_URL || 'http://localhost:3001'}/v1/auth/google/callback`,
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'online',
      prompt:        'select_account',
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  // ── Google OAuth: callback ──────────────────────────────────────────────────
  app.get<{ Querystring: { code?: string; error?: string } }>('/auth/google/callback', async (req, reply) => {
    const { code, error } = req.query;
    if (error || !code) return reply.redirect(`${FRONTEND_URL}?auth_error=google_denied`);

    try {
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:     GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri:  `${process.env.REGISTRY_PUBLIC_URL || 'http://localhost:3001'}/v1/auth/google/callback`,
          grant_type:    'authorization_code',
        }),
      });
      const tokens = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokens.access_token) throw new Error('No access token');

      // Get user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const gUser = await userRes.json() as { id: string; email: string; name: string; picture?: string };

      const user = await findOrCreateUser(gUser.email, gUser.name, 'google', gUser.id, gUser.picture);
      const token = signToken(user);

      return reply.redirect(`${FRONTEND_URL}?auth_token=${token}&is_new=${user.is_new}`);
    } catch (e) {
      console.error('[AUTH] Google callback error', e);
      return reply.redirect(`${FRONTEND_URL}?auth_error=google_failed`);
    }
  });

  // ── GitHub OAuth: initiate ──────────────────────────────────────────────────
  app.get('/auth/github', async (req, reply) => {
    if (!GITHUB_CLIENT_ID) {
      return reply.redirect(`${FRONTEND_URL}?auth_error=github_not_configured`);
    }
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope:     'read:user user:email',
    });
    return reply.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  // ── GitHub OAuth: callback ──────────────────────────────────────────────────
  app.get<{ Querystring: { code?: string; error?: string } }>('/auth/github/callback', async (req, reply) => {
    const { code, error } = req.query;
    if (error || !code) return reply.redirect(`${FRONTEND_URL}?auth_error=github_denied`);

    try {
      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) throw new Error('No access token');

      // Get user info
      const [userRes, emailsRes] = await Promise.all([
        fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Synapse-AAP' },
        }),
        fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Synapse-AAP' },
        }),
      ]);
      const ghUser   = await userRes.json()   as { id: number; login: string; name?: string; avatar_url?: string; email?: string };
      const ghEmails = await emailsRes.json() as { email: string; primary: boolean; verified: boolean }[];

      const primaryEmail = ghUser.email
        || ghEmails.find(e => e.primary && e.verified)?.email
        || ghEmails.find(e => e.verified)?.email
        || `${ghUser.login}@github.noreply`;

      const user = await findOrCreateUser(
        primaryEmail,
        ghUser.name ?? ghUser.login,
        'github',
        String(ghUser.id),
        ghUser.avatar_url
      );
      const token = signToken(user);

      return reply.redirect(`${FRONTEND_URL}?auth_token=${token}&is_new=${user.is_new}`);
    } catch (e) {
      console.error('[AUTH] GitHub callback error', e);
      return reply.redirect(`${FRONTEND_URL}?auth_error=github_failed`);
    }
  });

  // ── Get current user from token ─────────────────────────────────────────────
  app.get<{ Querystring: { token: string } }>('/auth/me', async (req, reply) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') ?? req.query.token ?? '';
      const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      const r = await db.query('SELECT * FROM synapse_users WHERE id = $1', [payload.sub]);
      if (!r.rows.length) return reply.code(404).send({ error: 'User not found' });
      return reply.send({ user: r.rows[0] });
    } catch {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });
}
