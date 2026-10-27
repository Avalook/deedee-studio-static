import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('hosted launcher fails closed before network access without secure configuration', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../start-hosted.mjs', import.meta.url))], {
    env: { ...process.env, POC_EDITOR_PASSWORD: '', POC_PUBLISHER_PASSWORD: '', CMS_GITHUB_TOKEN: '' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CMS startup refused/);
  assert.match(result.stderr, /POC_EDITOR_PASSWORD/);
});

test('askpass supplies credentials through environment only', () => {
  const helper = fileURLToPath(new URL('../git-askpass.mjs', import.meta.url));
  const env = { ...process.env, CMS_GITHUB_TOKEN: 'non-secret-test-token' };
  const username = spawnSync(process.execPath, [helper, 'Username for https://github.com'], { env, encoding: 'utf8' });
  const password = spawnSync(process.execPath, [helper, 'Password for https://github.com'], { env, encoding: 'utf8' });
  assert.equal(username.stdout, 'x-access-token\n');
  assert.equal(password.stdout, 'non-secret-test-token\n');
  assert.equal(password.stderr, '');
});
