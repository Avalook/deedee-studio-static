import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CMS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EMPTY_DOCUMENT = { schemaVersion: 1, pageId: '/', operations: [], insertions: [] };

async function reservePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`CMS process exited with ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }
  throw new Error('CMS server did not become ready');
}

async function login(origin, username, password) {
  const response = await fetch(`${origin}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookies = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  assert.equal(response.status, 200);
  const sessionResponse = await fetch(`${origin}/api/session`, { headers: { Cookie: cookies } });
  const session = await sessionResponse.json();
  return { cookies, csrf: session.csrf };
}

test('CMS saves a real-page override as draft and exposes it only after publisher release', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'deedee-site-cms-'));
  const staticServer = createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><head><title>Source DeeDee</title></head><body><main id="SITE_CONTAINER"><h1 id="hero">Original heading</h1></main></body></html>');
      return;
    }
    if (req.url === '/deedee-studio-static/assets/test.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' });
      res.end('test-image-bytes');
      return;
    }
    res.writeHead(404);
    res.end('missing');
  });
  staticServer.listen(0, '127.0.0.1');
  await once(staticServer, 'listening');
  const staticOrigin = `http://127.0.0.1:${staticServer.address().port}`;
  const cmsPort = await reservePort();
  const cmsOrigin = `http://127.0.0.1:${cmsPort}`;
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: CMS_DIR,
    env: {
      ...process.env,
      POC_HOST: '127.0.0.1',
      POC_PORT: String(cmsPort),
      POC_DATA_DIR: path.join(tempDir, 'data'),
      // Never export into the real repository from a test.
      CMS_EXPORT_DIR: path.join(tempDir, 'site'),
      CMS_GIT_PUSH: '0',
      POC_STATIC_SITE_ORIGIN: staticOrigin,
      POC_EDITOR_PASSWORD: 'editor-integration-password',
      POC_PUBLISHER_PASSWORD: 'publisher-integration-password',
      POC_SECRET: 'integration-secret-that-is-at-least-32-characters-long',
    },
    stdio: 'ignore',
  });
  t.after(async () => {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 1500))]);
    await new Promise((resolve) => staticServer.close(() => resolve()));
    await rm(tempDir, { recursive: true, force: true });
  });
  await waitForServer(`${cmsOrigin}/healthz`, child);

  const editor = await login(cmsOrigin, 'editor', 'editor-integration-password');
  const initial = await (await fetch(`${cmsOrigin}/api/site-state`, { headers: { Cookie: editor.cookies } })).json();
  assert.deepEqual(initial.document, EMPTY_DOCUMENT);

  const document = {
    schemaVersion: 1,
    pageId: '/',
    operations: [{ selector: '#hero', text: 'New DeeDee heading', offsets: { desktop: { x: 14, y: 3 } } }],
    insertions: [],
  };
  const savedResponse = await fetch(`${cmsOrigin}/api/site-state`, {
    method: 'PUT',
    headers: { Cookie: editor.cookies, 'Content-Type': 'application/json', 'X-CSRF-Token': editor.csrf },
    body: JSON.stringify({ baseRevisionId: initial.revisionId, document }),
  });
  assert.equal(savedResponse.status, 200);
  const saved = await savedResponse.json();
  const routeList = await (await fetch(`${cmsOrigin}/api/routes`, { headers: { Cookie: editor.cookies } })).json();
  assert(routeList.routes.some((route) => route.route === '/aboutus'));
  const aboutState = await (await fetch(`${cmsOrigin}/api/site-state?pageId=%2Faboutus`, { headers: { Cookie: editor.cookies } })).json();
  const aboutDocument = { schemaVersion: 1, pageId: '/aboutus', operations: [{ selector: '#hero', text: 'Updated about page' }], insertions: [] };
  const aboutSavedResponse = await fetch(`${cmsOrigin}/api/site-state?pageId=%2Faboutus`, {
    method: 'PUT', headers: { Cookie: editor.cookies, 'Content-Type': 'application/json', 'X-CSRF-Token': editor.csrf },
    body: JSON.stringify({ baseRevisionId: saved.revisionId, document: aboutDocument }),
  });
  assert.equal(aboutSavedResponse.status, 200);
  const aboutSaved = await aboutSavedResponse.json();

  const publicBefore = await (await fetch(`${cmsOrigin}/api/site-state/public`)).json();
  assert.deepEqual(publicBefore.document, EMPTY_DOCUMENT);
  const proxiedHome = await (await fetch(cmsOrigin)).text();
  assert.match(proxiedHome, /Source DeeDee/);
  assert.match(proxiedHome, /id="hero">Original heading/);
  assert.match(proxiedHome, /src="\/cms-runtime.js"/);
  const proxiedAsset = await fetch(`${cmsOrigin}/deedee-studio-static/assets/test.png`);
  assert.equal(proxiedAsset.status, 200);
  assert.equal(await proxiedAsset.text(), 'test-image-bytes');

  const editorPublish = await fetch(`${cmsOrigin}/api/versions/${saved.revisionId}/publish`, {
    method: 'POST', headers: { Cookie: editor.cookies, 'X-CSRF-Token': editor.csrf },
  });
  assert.equal(editorPublish.status, 403);

  const publisher = await login(cmsOrigin, 'publisher', 'publisher-integration-password');
  const publisherPublish = await fetch(`${cmsOrigin}/api/versions/${aboutSaved.revisionId}/publish`,  {
    method: 'POST', headers: { Cookie: publisher.cookies, 'X-CSRF-Token': publisher.csrf },
  });
  assert.equal(publisherPublish.status, 200);
  // Publishing also writes what the static GitHub Pages site needs.
  const publishPayload = await publisherPublish.json();
  assert.equal(publishPayload.export.enabled, true);
  assert.ok(publishPayload.export.pages >= 1);
  assert.equal(publishPayload.export.dir, path.join(tempDir, 'site'));
  const exported = JSON.parse(await readFile(path.join(tempDir, 'site', 'site-overrides.json'), 'utf8'));
  assert.equal(exported.revisionId, aboutSaved.revisionId);
  assert.equal(exported.publishedBy, 'publisher');
  assert.deepEqual(exported.pages['/aboutus'], aboutDocument);
  assert.equal(await readFile(path.join(tempDir, 'site', 'scripts', 'cms-runtime.js'), 'utf8'),
    await readFile(path.join(CMS_DIR, 'public', 'cms-runtime.js'), 'utf8'));
  const publicAfter = await (await fetch(`${cmsOrigin}/api/site-state/public`)).json();
  assert.deepEqual(publicAfter.document, document);
  const publicAbout = await (await fetch(`${cmsOrigin}/api/site-state/public?pageId=%2Faboutus`)).json();
  assert.deepEqual(publicAbout.document, aboutDocument);

  const previewToken = await fetch(`${cmsOrigin}/api/versions/${aboutSaved.revisionId}/preview-token`, {
    method: 'POST', headers: { Cookie: editor.cookies, 'X-CSRF-Token': editor.csrf },
  });
  assert.equal(previewToken.status, 200);
  const previewPayload = await previewToken.json();
  const previewState = await (await fetch(`${cmsOrigin}/api/site-state/preview?token=${encodeURIComponent(new URL(previewPayload.url, cmsOrigin).searchParams.get('token'))}&pageId=%2Faboutus`)).json();
  assert.deepEqual(previewState.document, aboutDocument);
});
