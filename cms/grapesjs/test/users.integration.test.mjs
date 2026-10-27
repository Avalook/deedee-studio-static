import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const CMS = fileURLToPath(new URL('..', import.meta.url));
const ADMIN_PASSWORD = 'admin-account-test-password';

test('account management: admin-only, last admin protected, sessions closed on change', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-users-'));
  const reserve = createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise((resolve) => reserve.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.mjs'], { cwd: CMS, stdio: 'ignore', env: { ...process.env,
    POC_HOSTED: '0', POC_HOST: '127.0.0.1', POC_PORT: String(port), POC_DATA_DIR: path.join(root, 'data'), CMS_EXPORT_DIR: path.join(root, 'site'),
    POC_STATIC_SITE_ORIGIN: 'http://127.0.0.1:9', POC_EDITOR_PASSWORD: 'editor-account-test-password', POC_PUBLISHER_PASSWORD: 'publisher-account-test-password',
    POC_ADMIN_PASSWORD: ADMIN_PASSWORD } });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } await rm(root, { recursive: true, force: true }); });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/healthz`)).ok) break; } catch { /* not ready */ }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  async function call(route, { method = 'GET', session, body } = {}) {
    const response = await fetch(`${origin}${route}`, { method, redirect: 'manual', headers: { ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, json: await response.json().catch(() => ({})) };
  }
  async function login(username, password) {
    const response = await fetch(`${origin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!response.ok) return null;
    const payload = await response.json();
    return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: payload.csrf, user: payload.user };
  }

  assert.deepEqual(await (await fetch(`${origin}/api/login-hint`)).json(), { demo: false }, 'demo hint is hidden once passwords come from the environment');
  const admin = await login('admin', ADMIN_PASSWORD);
  assert.equal(admin.user.role, 'admin');
  const editor = await login('editor', 'editor-account-test-password');
  const publisher = await login('publisher', 'publisher-account-test-password');
  assert.equal(publisher.user.role, 'publisher', 'a dedicated admin leaves the publisher as it was');

  assert.equal((await call('/api/users')).status, 401);
  assert.equal((await call('/api/users', { session: editor })).status, 403);
  assert.equal((await call('/api/users', { session: publisher })).status, 403);
  const list = await call('/api/users', { session: admin });
  assert.deepEqual(list.json.users.map((user) => user.username), ['admin', 'editor', 'publisher']);
  assert.ok(list.json.users.every((user) => !('passwordHash' in user)));

  // Creating accounts checks name, role and password strength.
  assert.equal((await call('/api/users', { method: 'POST', session: admin, body: { username: 'x', password: 'long-enough-password', role: 'editor' } })).status, 400);
  assert.equal((await call('/api/users', { method: 'POST', session: admin, body: { username: 'anna', password: 'short', role: 'editor' } })).status, 400);
  assert.equal((await call('/api/users', { method: 'POST', session: admin, body: { username: 'anna', password: 'editor-demo', role: 'editor' } })).status, 400);
  assert.equal((await call('/api/users', { method: 'POST', session: admin, body: { username: 'anna', password: 'long-enough-password', role: 'owner' } })).status, 400);
  const created = await call('/api/users', { method: 'POST', session: admin, body: { username: 'anna', password: 'long-enough-password', role: 'editor' } });
  assert.equal(created.status, 201);
  assert.equal((await call('/api/users', { method: 'POST', session: admin, body: { username: 'ANNA', password: 'long-enough-password', role: 'editor' } })).status, 409);
  const anna = await login('anna', 'long-enough-password');
  assert.equal(anna.user.role, 'editor');

  // A role change closes that user's sessions; the new role applies on the next sign-in.
  const promoted = await call(`/api/users/${created.json.user.id}`, { method: 'PATCH', session: admin, body: { role: 'publisher' } });
  assert.equal(promoted.status, 200);
  assert.equal((await call('/api/session', { session: anna })).status, 401);
  assert.equal((await login('anna', 'long-enough-password')).user.role, 'publisher');

  // Admin password reset signs the account out and the old password stops working.
  assert.equal((await call(`/api/users/${created.json.user.id}`, { method: 'PATCH', session: admin, body: { password: 'another-long-password' } })).status, 200);
  assert.equal(await login('anna', 'long-enough-password'), null);
  assert.ok(await login('anna', 'another-long-password'));

  // Own password change needs the current password and keeps the current session.
  assert.equal((await call('/api/account/password', { method: 'POST', session: editor, body: { currentPassword: 'wrong', newPassword: 'fresh-secret-phrase-1' } })).status, 403);
  assert.equal((await call('/api/account/password', { method: 'POST', session: editor, body: { currentPassword: 'editor-account-test-password', newPassword: 'fresh-secret-phrase-1' } })).status, 200);
  assert.equal((await call('/api/session', { session: editor })).status, 200);
  assert.equal(await login('editor', 'editor-account-test-password'), null);
  assert.ok(await login('editor', 'fresh-secret-phrase-1'));

  // Guard rails: no self-delete, no self role change, the last admin cannot be removed or demoted.
  const adminId = list.json.users.find((user) => user.username === 'admin').id;
  assert.equal((await call(`/api/users/${adminId}`, { method: 'DELETE', session: admin })).status, 409);
  assert.equal((await call(`/api/users/${adminId}`, { method: 'PATCH', session: admin, body: { role: 'editor' } })).status, 409);
  const second = await call('/api/users', { method: 'POST', session: admin, body: { username: 'boss', password: 'team-lead-phrase-123', role: 'admin' } });
  const boss = await login('boss', 'team-lead-phrase-123');
  assert.equal((await call(`/api/users/${adminId}`, { method: 'PATCH', session: boss, body: { role: 'editor' } })).status, 200, 'with two admins one can be demoted');
  assert.equal((await call(`/api/users/${second.json.user.id}`, { method: 'PATCH', session: boss, body: { role: 'editor' } })).status, 409, 'self role change is refused');
  assert.equal((await call(`/api/users/${second.json.user.id}`, { method: 'DELETE', session: boss })).status, 409);

  // Deleting removes the account and its sessions.
  assert.equal((await call(`/api/users/${created.json.user.id}`, { method: 'DELETE', session: boss })).status, 200);
  assert.equal(await login('anna', 'another-long-password'), null);

  // The page itself needs a session.
  assert.equal((await fetch(`${origin}/admin/users`, { redirect: 'manual' })).status, 302);
});
