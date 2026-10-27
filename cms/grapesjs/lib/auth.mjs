import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, 64, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = scryptSync(String(password), salt, expected.length, SCRYPT_OPTIONS);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionStore({ ttlMs }) {
  const sessions = new Map();

  function prune(now = Date.now()) {
    for (const [key, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(key);
    }
  }

  return {
    create(user) {
      prune();
      const token = randomBytes(32).toString('base64url');
      const csrf = randomBytes(24).toString('base64url');
      const session = {
        user: { id: user.id, username: user.username, role: user.role },
        csrf,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      };
      sessions.set(hashSessionToken(token), session);
      return { token, csrf, session };
    },
    get(token) {
      if (typeof token !== 'string' || token.length < 20) return null;
      prune();
      const session = sessions.get(hashSessionToken(token));
      if (!session) return null;
      return { token, ...session };
    },
    destroy(token) {
      if (typeof token === 'string') sessions.delete(hashSessionToken(token));
    },
    count() {
      prune();
      return sessions.size;
    },
  };
}

export function createLoginLimiter({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();

  function read(ip) {
    const now = Date.now();
    const record = attempts.get(ip);
    if (!record || record.resetAt <= now) {
      attempts.set(ip, { count: 0, resetAt: now + windowMs });
      return attempts.get(ip);
    }
    return record;
  }

  return {
    check(ip) {
      const record = read(ip);
      if (record.count >= max) {
        return { blocked: true, retryAfterSeconds: Math.ceil((record.resetAt - Date.now()) / 1000) };
      }
      return { blocked: false };
    },
    fail(ip) {
      const record = read(ip);
      record.count += 1;
    },
    reset(ip) {
      attempts.delete(ip);
    },
  };
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function serializeSessionCookie(token, maxAgeSeconds, secure = false) {
  return `poc_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export function serializePreviewCookie(token, maxAgeSeconds, secure = false) {
  return `poc_preview=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie() {
  return 'poc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
}

export function clearPreviewCookie() {
  return 'poc_preview=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}

function signHmac(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function signPreviewToken({ revisionId, userId, expiresAt }, secret) {
  const payload = Buffer.from(
    JSON.stringify({
      rev: String(revisionId),
      uid: String(userId),
      exp: Math.floor(expiresAt / 1000),
    }),
  ).toString('base64url');
  return `${payload}.${signHmac(payload, secret)}`;
}

export function verifyPreviewToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = signHmac(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(data.exp) || data.exp * 1000 <= now) return null;
    if (typeof data.rev !== 'string' || typeof data.uid !== 'string') return null;
    return { revisionId: data.rev, userId: data.uid, expiresAt: data.exp * 1000 };
  } catch {
    return null;
  }
}
