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

test('uploads accept images and short videos by content, and enforce the per-kind limits', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-upload-'));
  const reserve = createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise((resolve) => reserve.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.mjs'], { cwd: CMS, stdio: 'ignore', env: { ...process.env,
    POC_HOSTED: '0', POC_HOST: '127.0.0.1', POC_PORT: String(port), POC_DATA_DIR: path.join(root, 'data'), CMS_EXPORT_DIR: path.join(root, 'site'),
    POC_STATIC_SITE_ORIGIN: 'http://127.0.0.1:9', POC_EDITOR_PASSWORD: 'editor-upload-test-pass', POC_PUBLISHER_PASSWORD: 'publisher-upload-test-pass',
    POC_ADMIN_PASSWORD: 'admin-upload-test-pass' } });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } await rm(root, { recursive: true, force: true }); });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/healthz`)).ok) break; } catch { /* not ready */ }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  const login = await fetch(`${origin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'editor', password: 'editor-upload-test-pass' }) });
  const { csrf } = await login.json(); const cookie = login.headers.get('set-cookie').split(';')[0];
  const upload = async (bytes, name) => {
    const form = new FormData(); form.append('files', new Blob([bytes]), name);
    const response = await fetch(`${origin}/api/uploads`, { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: form });
    return { status: response.status, json: await response.json() };
  };
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(1024)]);
  const ok = await upload(mp4, 'clip.mp4');
  assert.equal(ok.status, 200); assert.match(ok.json.data[0].src, /^\/media\/[a-f0-9-]{36}\.mp4$/); assert.equal(ok.json.data[0].type, 'video/mp4');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal((await upload(Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]), 'big.png')).status, 413, 'images stop at 5 MB');
  assert.equal((await upload(Buffer.concat([png, Buffer.alloc(1024)]), 'small.png')).status, 200);
  assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg')).status, 415);
  assert.equal((await upload(Buffer.from('#!/bin/sh\necho pwned'), 'evil.mp4')).status, 415, 'the name never decides the type');
});
