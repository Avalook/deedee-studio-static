import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { prepareRepository } from '../lib/hosted-repository.mjs';
import { createPublishQueue } from '../lib/publish-queue.mjs';

const CMS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('publish queue serializes requests and continues after a failed request', async () => {
  const queue = createPublishQueue();
  const events = [];
  const first = queue(async () => { events.push(1); await Promise.resolve(); events.push(2); throw new Error('failure'); });
  const second = queue(async () => events.push(3));
  await assert.rejects(first);
  await second;
  assert.deepEqual(events, [1, 2, 3]);
});

test('hosted HTTP flow persists drafts, proxies prefixed archive, uploads and publishes to Git', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-hosted-'));
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed');
  const checkout = path.join(root, 'publish');
  const git = (args, cwd = root) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString();
  git(['init', '--bare', '--initial-branch=main', remote]);
  await mkdir(seed);
  git(['init', '--initial-branch=main'], seed);
  git(['config', 'user.name', 'Test'], seed); git(['config', 'user.email', 'test@example.com'], seed);
  await writeFile(path.join(seed, 'site-overrides.json'), '{}');
  git(['add', '.'], seed); git(['commit', '-m', 'seed'], seed);
  git(['remote', 'add', 'origin', remote], seed); git(['push', 'origin', 'main'], seed);
  await prepareRepository({ repoDir: checkout, repositoryUrl: remote });
  const archive = createServer((req, res) => {
    if (req.url === '/deedee-studio-static/' || req.url === '/deedee-studio-static/aboutus/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1 id="hero">Original</h1></body></html>');
    } else { res.writeHead(404); res.end('missing'); }
  });
  archive.listen(0, '127.0.0.1'); await once(archive, 'listening');
  const reserve = net.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise((resolve) => reserve.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const origin = 'https://cms.example.com';
  const env = { ...process.env, POC_HOSTED: '1', POC_HOST: '127.0.0.1', POC_PORT: String(port),
    POC_ORIGIN: origin, POC_DATA_DIR: path.join(root, 'data'), CMS_EXPORT_DIR: checkout, CMS_GIT_PUSH: '1',
    POC_STATIC_SITE_ORIGIN: `http://127.0.0.1:${archive.address().port}/deedee-studio-static/`,
    POC_EDITOR_PASSWORD: 'editor-integration-password', POC_PUBLISHER_PASSWORD: 'publisher-integration-password' };
  let child;
  const stop = async () => {
    if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  };
  t.after(async () => { await stop(); await new Promise((resolve) => archive.close(resolve)); await rm(root, { recursive: true, force: true }); });
  async function start() {
    child = spawn(process.execPath, ['server.mjs'], { cwd: CMS_DIR, env, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error('Hosted CMS exited before health check');
      try { if ((await fetch(`${base}/healthz`)).ok) return; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    throw new Error('Hosted CMS not ready');
  }
  await start();
  const badOrigin = await fetch(`${base}/api/login`, { method: 'POST', headers: { Origin: 'https://other.example.com' } });
  assert.equal(badOrigin.status, 403);
  assert.equal((await fetch(`${base}/api/login`, { method: 'POST' })).status, 403);
  async function login() {
    const response = await fetch(`${base}/api/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'publisher', password: env.POC_PUBLISHER_PASSWORD }) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /; Secure/);
    const payload = await response.json();
    return { Origin: origin, Cookie: response.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': payload.csrf };
  }
  let headers = await login();
  assert.equal((await fetch(`${base}/admin`, { headers })).status, 200);
  assert.match(await (await fetch(base)).text(), /src="\/cms-runtime.js"/);
  assert.match(await (await fetch(`${base}/aboutus`)).text(), /Original/);
  const prefixedPage = await (await fetch(`${base}/deedee-studio-static/aboutus/`)).text();
  assert.match(prefixedPage, /data-base="\/deedee-studio-static"/);
  assert.doesNotMatch(prefixedPage, /defer src="\/cms-runtime.js"/);
  const initial = await (await fetch(`${base}/api/site-state`, { headers })).json();
  const form = new FormData();
  form.set('file', new Blob([Buffer.from('89504e470d0a1a0a00000000', 'hex')], { type: 'image/png' }), 'tiny.png');
  const uploaded = await fetch(`${base}/api/uploads`, { method: 'POST', headers, body: form });
  assert.equal(uploaded.status, 200);
  const asset = (await uploaded.json()).data[0];
  const saved = await fetch(`${base}/api/site-state`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRevisionId: initial.revisionId, document: { schemaVersion: 1, pageId: '/',
      operations: [{ selector: '#hero', text: 'Published online' }, { selector: '#photo', image: asset.src }], insertions: [] } }) });
  assert.equal(saved.status, 200);
  const revisionId = (await saved.json()).revisionId;
  const previewTokenResponse = await fetch(`${base}/api/versions/${revisionId}/preview-token`, { method: 'POST', headers });
  const previewLink = (await previewTokenResponse.json()).url;
  const previewResponse = await fetch(`${base}${previewLink}`);
  assert.equal(previewResponse.status, 200);
  assert.match(previewResponse.headers.get('set-cookie'), /; Secure/);
  assert.match(await previewResponse.text(), /data-base="\/deedee-studio-static"/);
  await stop(); await start(); headers = await login();
  assert.equal((await (await fetch(`${base}/api/site-state`, { headers })).json()).revisionId, revisionId);
  // Simulate a rejected push: the API must not announce this release as published.
  await mkdir(path.join(remote, 'hooks'), { recursive: true });
  await writeFile(path.join(remote, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  const failed = await fetch(`${base}/api/versions/${revisionId}/publish`, { method: 'POST', headers });
  assert.equal(failed.status, 502);
  const before = await (await fetch(`${base}/api/site-state/public`)).json();
  assert.deepEqual(before.document.operations, []);
  await rm(path.join(remote, 'hooks', 'pre-receive'));
  const published = await fetch(`${base}/api/versions/${revisionId}/publish`, { method: 'POST', headers });
  assert.equal(published.status, 200);
  assert.equal((await published.json()).export.git.pushed, true);
  const contents = JSON.parse(git(['show', 'main:site-overrides.json'], remote));
  assert.equal(contents.pages['/'].operations[0].text, 'Published online');
  assert.match(contents.pages['/'].operations[1].image, /^\/deedee-studio-static\/assets\/cms\//);
  assert.ok((await readFile(path.join(checkout, 'assets', 'cms', path.basename(asset.src)))).length > 0);
});
