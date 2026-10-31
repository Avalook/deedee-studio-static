import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gitEnvironment, isActivationCode } from '../src/git-env.mjs';
import { ONE_USER_CSS } from '../src/one-user.mjs';
import { createSecrets, newSecrets } from '../src/secrets.mjs';

const CODE = `github_pat_${'a'.repeat(40)}`;

test('Git uses the bundled copy and receives the code only as an environment header', () => {
  const env = gitEnvironment({ PATH: '/usr/bin', HOME: '/home/x' }, { gitDir: '/app/git', token: CODE, platform: 'darwin' });
  assert.equal(env.PATH, '/app/git/bin:/usr/bin');
  assert.equal(env.GIT_EXEC_PATH, '/app/git/libexec/git-core');
  assert.equal(env.GIT_CONFIG_KEY_0, 'http.https://github.com/.extraheader');
  assert.equal(Buffer.from(env.GIT_CONFIG_VALUE_0.split(' ').at(-1), 'base64').toString(), `x-access-token:${CODE}`);
});

test('Windows keeps its own spelling of the path variable', () => {
  const env = gitEnvironment({ Path: 'C:\\Windows' }, { gitDir: 'C:\\app\\git', token: CODE, platform: 'win32' });
  assert.equal(env.Path, 'C:\\app\\git\\cmd;C:\\app\\git\\mingw64\\bin;C:\\app\\git\\usr\\bin;C:\\Windows');
  assert.equal(env.PATH, undefined);
  assert.equal(env.GIT_EXEC_PATH, 'C:\\app\\git\\mingw64\\libexec\\git-core');
  assert.equal(env.GIT_CONFIG_KEY_1, 'core.protectNTFS');
});

test('the activation code is the only access: accounts and sign-out are not shown', () => {
  for (const selector of ['#logout', '.account', '#user', '#role-note', 'a[href="/admin/users"]']) assert.ok(ONE_USER_CSS.includes(selector), selector);
});

test('activation codes are checked before anything is stored', () => {
  assert.ok(isActivationCode(`  ${CODE}\n`));
  assert.ok(isActivationCode(`ghp_${'b'.repeat(36)}`));
  for (const bad of ['', 'password', 'github_pat_short', null, undefined]) assert.equal(isActivationCode(bad), false);
});

test('secrets are stored only through the operating system cipher', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'deedee-secrets-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cipher = { encryptString: (text) => Buffer.from([...Buffer.from(text)].reverse()), decryptString: (data) => Buffer.from([...data].reverse()).toString() };
  const secrets = createSecrets({ dir, cipher });
  assert.equal(await secrets.read(), null);
  const values = await secrets.write(newSecrets({ token: CODE }));
  assert.equal(values.adminPassword.length, 32);
  assert.notEqual(values.adminPassword, values.publisherPassword);
  assert.deepEqual(await secrets.read(), values);
  if (process.platform !== 'win32') assert.equal((await stat(path.join(dir, 'secrets.bin'))).mode & 0o777, 0o600);
  await secrets.clear();
  assert.equal(await secrets.read(), null);
});
