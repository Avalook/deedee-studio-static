import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLoginLimiter,
  createSessionStore,
  hashPassword,
  signPreviewToken,
  verifyPassword,
  verifyPreviewToken,
} from '../lib/auth.mjs';

test('password hashes verify only the original password', () => {
  const stored = hashPassword('correct horse battery staple');
  assert.equal(verifyPassword('correct horse battery staple', stored), true);
  assert.equal(verifyPassword('wrong', stored), false);
  assert.equal(verifyPassword('correct horse battery staple', 'not-a-hash'), false);
});

test('sessions are opaque, retrievable and destroyable', () => {
  const sessions = createSessionStore({ ttlMs: 60_000 });
  const created = sessions.create({ id: 'user_editor', username: 'editor', role: 'editor' });
  assert.ok(created.token.length >= 40);
  assert.ok(created.csrf.length >= 20);

  const found = sessions.get(created.token);
  assert.equal(found.user.role, 'editor');
  assert.equal(found.csrf, created.csrf);

  sessions.destroy(created.token);
  assert.equal(sessions.get(created.token), null);
});

test('sessions expire', async () => {
  const sessions = createSessionStore({ ttlMs: 1 });
  const created = sessions.create({ id: 'user_editor', username: 'editor', role: 'editor' });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(sessions.get(created.token), null);
});

test('login limiter blocks after the configured number of failures', () => {
  const limiter = createLoginLimiter({ max: 2, windowMs: 60_000 });
  assert.equal(limiter.check('127.0.0.1').blocked, false);
  limiter.fail('127.0.0.1');
  limiter.fail('127.0.0.1');
  const blocked = limiter.check('127.0.0.1');
  assert.equal(blocked.blocked, true);
  assert.ok(blocked.retryAfterSeconds > 0);

  limiter.reset('127.0.0.1');
  assert.equal(limiter.check('127.0.0.1').blocked, false);
});

test('preview tokens are signed, scoped and expiring', () => {
  const secret = 'a'.repeat(64);
  const expiresAt = Date.now() + 60_000;
  const token = signPreviewToken({ revisionId: 'rev_x', userId: 'user_editor', expiresAt }, secret);

  const payload = verifyPreviewToken(token, secret);
  assert.equal(payload.revisionId, 'rev_x');
  assert.equal(payload.userId, 'user_editor');
  assert.equal(payload.expiresAt, Math.floor(expiresAt / 1000) * 1000);

  assert.equal(verifyPreviewToken(token, 'b'.repeat(64)), null);
  assert.equal(verifyPreviewToken(`${token}x`, secret), null);
  assert.equal(verifyPreviewToken('not-a-token', secret), null);
  assert.equal(verifyPreviewToken(token, secret, expiresAt + 1), null);
});
