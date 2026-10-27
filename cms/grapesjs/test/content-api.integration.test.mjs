import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const CMS = fileURLToPath(new URL('..', import.meta.url));

test('content API authorizes, isolates drafts, publishes/unpublishes generated pages and retries Git failure', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-content-api-'));
  const out = path.join(root, 'site'); const remote = path.join(root, 'remote.git'); await mkdir(out);
  const git = (args, cwd = out) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString();
  git(['init', '--bare', '--initial-branch=main', remote]); git(['init', '--initial-branch=main']);
  git(['config', 'user.name', 'CMS test']); git(['config', 'user.email', 'cms@example.com']);
  await writeFile(path.join(out, 'site-overrides.json'), '{"keep":true}');
  git(['add', '.']); git(['commit', '-m', 'seed']); git(['remote', 'add', 'origin', remote]); git(['push', 'origin', 'main']);
  const reserve = createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise((resolve) => reserve.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const archive = createServer((_req, res) => { res.writeHead(404); res.end('archive missing'); });
  archive.listen(0, '127.0.0.1'); await once(archive, 'listening');
  let child;
  const stop = async () => { if (child?.exitCode === null) { child.kill(); await once(child, 'exit'); } };
  t.after(async () => { await stop(); await new Promise((resolve) => archive.close(resolve)); await rm(root, { recursive: true, force: true }); });
  async function start() {
    child = spawn(process.execPath, ['server.mjs'], { cwd: CMS, stdio: 'ignore', env: { ...process.env,
      POC_HOSTED: '0', POC_HOST: '127.0.0.1', POC_PORT: String(port), POC_DATA_DIR: path.join(root, 'data'),
      CMS_EXPORT_DIR: out, CMS_GIT_PUSH: '1', POC_STATIC_SITE_ORIGIN: `http://127.0.0.1:${archive.address().port}`,
      POC_EDITOR_PASSWORD: 'editor-content-test-password', POC_PUBLISHER_PASSWORD: 'publisher-content-test-password' } });
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error('CMS exited');
      try { if ((await fetch(`${origin}/healthz`)).ok) return; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    throw new Error('CMS not ready');
  }
  await start();
  async function request(route, { method = 'GET', headers = {}, body } = {}) {
    const response = await fetch(`${origin}${route}`, { method, headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
    return response;
  }
  async function login(username) {
    const response = await request('/api/login', { method: 'POST', body: { username, password: `${username}-content-test-password` } });
    const payload = await response.json(); return { Cookie: response.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': payload.csrf };
  }
  assert.equal((await request('/api/content')).status, 401);
  assert.equal((await request('/admin/content')).status, 302);
  const editor = await login('editor'); const publisher = await login('publisher');
  assert.equal((await request('/admin/content', { headers: editor })).status, 200);
  const form = new FormData();
  form.set('file', new Blob([Buffer.from('89504e470d0a1a0a00000000', 'hex')], { type: 'image/png' }), 'cover.png');
  const uploaded = await fetch(`${origin}/api/uploads`, { method: 'POST', headers: editor, body: form });
  assert.equal(uploaded.status, 200);
  const cover = (await uploaded.json()).data[0].src;
  assert.equal((await request(`/deedee-studio-static${cover}`)).status, 404);
  const draft = { type: 'article', language: 'vi', slug: 'integration-article', title: 'Article one',
    bodyHtml: '<p>Hello</p><script>alert(1)</script>', cover, gallery: [] };
  assert.equal((await request('/api/content', { method: 'POST', headers: { Cookie: editor.Cookie }, body: { item: draft } })).status, 403);
  const created = await request('/api/content', { method: 'POST', headers: editor, body: { item: draft } });
  assert.equal(created.status, 201); const item = (await created.json()).item;
  assert.doesNotMatch(item.bodyHtml, /script/);
  assert.equal((await request(`/admin/content/${item.id}/preview`)).status, 401);
  const preview = await request(`/admin/content/${item.id}/preview`, { headers: editor });
  assert.equal(preview.status, 200); assert.match(await preview.text(), /Article one/);
  assert.deepEqual((await (await request('/content.json')).json()).items, []);
  assert.equal((await request(item.route)).status, 404);
  assert.equal((await request(`/api/content/${item.id}/publish`, { method: 'POST', headers: editor })).status, 403);
  // Hold Git publication open while an editor attempts to move the first-published route.
  await writeFile(path.join(remote, 'hooks', 'pre-receive'), '#!/bin/sh\nsleep 0.3\nexit 0\n', { mode: 0o700 });
  const publication = request(`/api/content/${item.id}/publish`, { method: 'POST', headers: publisher });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const routeChange = request(`/api/content/${item.id}`, { method: 'PUT', headers: editor, body: { item: { slug: 'race-renamed' } } });
  const published = await publication;
  assert.equal(published.status, 200);
  assert.equal((await routeChange).status, 409);
  await rm(path.join(remote, 'hooks', 'pre-receive')); assert.equal((await published.json()).export.git.pushed, true);
  assert.match(git(['show', `main:${item.route.slice(1)}/index.html`], remote), /Article one/);
  assert.equal(await readFile(path.join(out, 'site-overrides.json'), 'utf8'), '{"keep":true}');
  assert.equal((await request(item.route)).status, 200);
  assert.equal((await request(`/deedee-studio-static${cover}`)).status, 200);
  assert.equal((await request(cover)).status, 200);
  assert.equal((await request(`/deedee-studio-static${item.route}/`)).status, 200);
  const updated = await request(`/api/content/${item.id}`, { method: 'PUT', headers: editor, body: { item: { title: 'Draft two' } } });
  assert.equal(updated.status, 200); assert.equal((await updated.json()).item.hasUnpublishedChanges, true);
  assert.equal((await (await request('/content.json')).json()).items[0].title, 'Article one');
  await stop(); await start(); const freshPublisher = await login('publisher');
  assert.equal((await (await request(`/api/content/${item.id}`, { headers: freshPublisher })).json()).item.title, 'Draft two');
  await writeFile(path.join(remote, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  assert.equal((await request(`/api/content/${item.id}/publish`, { method: 'POST', headers: freshPublisher })).status, 502);
  assert.equal((await (await request('/content.json')).json()).items[0].title, 'Article one');
  await rm(path.join(remote, 'hooks', 'pre-receive'));
  assert.equal((await request(`/api/content/${item.id}/publish`, { method: 'POST', headers: freshPublisher })).status, 200);
  assert.equal((await (await request('/content.json')).json()).items[0].title, 'Draft two');
  const projectResponse = await request('/api/content', { method: 'POST', headers: freshPublisher, body: { item: { ...draft, type: 'project', language: 'en', slug: 'integration-project', title: 'Project one' } } });
  const project = (await projectResponse.json()).item;
  assert.equal((await request(`/api/content/${project.id}/publish`, { method: 'POST', headers: freshPublisher })).status, 200);
  assert.equal((await request(project.route)).status, 200);
  const unpublish = await request(`/api/content/${item.id}/unpublish`, { method: 'POST', headers: freshPublisher });
  assert.equal(unpublish.status, 200); assert.ok((await unpublish.json()).item.firstPublishedAt);
  await assert.rejects(access(path.join(out, item.route.slice(1), 'index.html')));
  assert.equal((await request(item.route)).status, 404);
  assert.equal((await (await request('/content.json')).json()).items.length, 1);
  assert.equal((await request(`/api/content/${item.id}`, { method: 'PUT', headers: freshPublisher, body: { item: { slug: 'renamed' } } })).status, 409);
  const list = (await (await request('/api/content', { headers: freshPublisher })).json()).items;
  assert.equal(list.length, 2); assert.equal((await request('/api/content/not-valid')).status, 404);
  // Existing page overrides must obey the same main-only publication rule as new content.
  const pageDraft = await (await request('/api/site-state', { headers: freshPublisher })).json();
  git(['switch', '-c', 'wrong-publication-branch']);
  assert.equal((await request(`/api/versions/${pageDraft.revisionId}/publish`, { method: 'POST', headers: freshPublisher })).status, 502);
  assert.equal(git(['branch', '--show-current']).trim(), 'wrong-publication-branch');
  git(['switch', 'main']);
});
