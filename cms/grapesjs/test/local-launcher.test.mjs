import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../../../', import.meta.url);

test('mac launcher has valid shell syntax and safe local defaults', async () => {
  const file = new URL('Start-CMS.command', root);
  const source = await readFile(file, 'utf8');
  const result = spawnSync('/bin/bash', ['-n', file.pathname], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(source, /POC_HOST=127\.0\.0\.1/);
  assert.match(source, /CMS_GIT_PUSH:=1/);
  assert.match(source, /npm --prefix cms\/grapesjs ci --ignore-scripts/);
  assert.match(source, /node cms\/grapesjs\/server\.mjs/);
  assert.doesNotMatch(source, /rm\s+-|git\s+(?:reset|push|commit)/);
});

test('Windows launcher checks prerequisites and keeps safe local defaults', async () => {
  const source = await readFile(new URL('Start-CMS.cmd', root), 'utf8');
  assert.match(source, /where node/);
  assert.match(source, /where npm/);
  assert.match(source, /POC_HOST=127\.0\.0\.1/);
  assert.match(source, /if not defined CMS_GIT_PUSH set "CMS_GIT_PUSH=1"/);
  assert.match(source, /call npm --prefix cms\\grapesjs ci --ignore-scripts/);
  assert.doesNotMatch(source, /^(?:rmdir|del|git (?:reset|push|commit))\b/im);
});
