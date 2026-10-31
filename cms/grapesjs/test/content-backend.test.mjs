import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { validateContent } from '../lib/content-schema.mjs';
import { createContentStore } from '../lib/content-store.mjs';
import { exportContent } from '../lib/content-export.mjs';

const item = (extra = {}) => ({ type: 'article', language: 'vi', slug: 'bai-moi', title: 'Bài mới', bodyHtml: '<p>Nội dung</p>', ...extra });

test('content input sanitizes rich text, rejects unsafe paths and freezes identity', () => {
  const clean = validateContent(item({ bodyHtml: '<script>alert(1)</script><p onclick="x()">Hello <a href="javascript:alert(1)">link</a></p>' }));
  assert.doesNotMatch(clean.bodyHtml, /script|onclick|javascript/);
  assert.equal(clean.route, '/post/bai-moi');
  assert.equal(validateContent(item({ type: 'project', language: 'en' })).route, '/en/all-project/bai-moi');
  for (const slug of ['../x', 'x/y', '%2e', '', 'UPPER', '-hello']) assert.throws(() => validateContent(item({ slug })));
  for (const cover of ['javascript:alert(1)', '//example.com/a.jpg', '/assets/../secret', '/cms/data/users.json']) {
    assert.throws(() => validateContent(item({ cover })));
  }
  assert.throws(() => validateContent(item({ type: 'project' }), { ...clean, id: 'x' }), /type/);
  for (const extra of [{ featured: 'yes' }, { gallery: 'image' }, { year: 'bad' }, { publishedAt: 'never' }, { title: '' }, { language: 'fr' }]) {
    assert.throws(() => validateContent(item(extra)));
  }
  const images = validateContent(item({ bodyHtml: '<figure><img src="/media/12345678-1234-1234-1234-123456789abc.png" alt="Cover"><img src="javascript:alert(1)"></figure>', videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }));
  assert.match(images.bodyHtml, /alt="Cover"/);
  assert.doesNotMatch(images.bodyHtml, /javascript/);
});

test('draft and published snapshot lifecycle persists and protects original routes', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'content-store-')); t.after(() => rm(root, { recursive: true, force: true }));
  const args = { dataDir: path.join(root, 'data'), staticSiteDir: root, reservedRoutes: ['/post/archived'] };
  const store = await createContentStore(args);
  await assert.rejects(store.create(item({ slug: 'archived' })), /đường dẫn/i);
  await mkdir(path.join(root, 'post', 'existing'), { recursive: true });
  await writeFile(path.join(root, 'post', 'existing', 'index.html'), 'archive');
  await assert.rejects(store.create(item({ slug: 'existing' })), /route/i);
  const first = await store.create(item());
  assert.equal(first.status, 'draft'); assert.equal(first.isPublished, false);
  await assert.rejects(store.create(item()), /đường dẫn/i);
  assert.deepEqual(await store.published(), []);
  await store.commitPublication(first.id, first);
  const changed = await store.update(first.id, item({ title: 'Draft changed' }));
  assert.equal(changed.hasUnpublishedChanges, true);
  assert.equal((await store.published())[0].title, 'Bài mới');
  await assert.rejects(store.update(first.id, item({ slug: 'renamed' })), /route/i);
  const reopened = await createContentStore(args);
  assert.equal((await reopened.get(first.id)).title, 'Draft changed');
  assert.equal((await reopened.published())[0].title, 'Bài mới');
  await reopened.commitPublication(first.id, null);
  assert.deepEqual(await reopened.published(), []);
  await assert.rejects(reopened.create(item()), /đường dẫn/i);
});

test('new machine imports published snapshots and stale catalog exports fail safely', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'content-multi-')); t.after(() => rm(root, { recursive: true, force: true }));
  const id = 'content_12345678-1234-1234-1234-123456789abc';
  const snapshot = { ...validateContent(item()), id };
  const catalog = path.join(root, 'content.json');
  await writeFile(catalog, JSON.stringify({ version: 1, items: [snapshot] }));
  const imported = await createContentStore({ dataDir: path.join(root, 'new-machine'), staticSiteDir: root, publicCatalogFile: catalog });
  assert.equal((await imported.list())[0].status, 'published');
  assert.equal((await imported.published())[0].id, id);
  await assert.rejects(exportContent({ items: [], previousItems: [], outDir: root, uploadsDir: root, sourceDir: root, renderPage: () => '' }), /another machine/);
  assert.equal(JSON.parse(await readFile(catalog, 'utf8')).items.length, 1);
});

test('content export writes exact owned files, rewrites media and deletes only generated pages', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'content-export-')); t.after(() => rm(root, { recursive: true, force: true }));
  const outDir = path.join(root, 'out'); const uploadsDir = path.join(root, 'uploads'); const sourceDir = path.join(root, 'source');
  await mkdir(uploadsDir); await mkdir(path.join(sourceDir, 'scripts'), { recursive: true });
  for (const file of ['content-cards.mjs', 'content-cards.css', 'site-controls.mjs']) await writeFile(path.join(sourceDir, 'scripts', file), '// runtime');
  const file = '12345678-1234-1234-1234-123456789abc.png'; await writeFile(path.join(uploadsDir, file), 'image');
  const published = { ...validateContent(item({ cover: `/media/${file}` })), id: 'id-1' };
  const args = { outDir, uploadsDir, sourceDir, previousItems: [], items: [published], renderPage: (entry) => `<html>${entry.title}</html>` };
  const result = await exportContent(args);
  assert.ok(result.files.includes('post/bai-moi/index.html'));
  assert.ok(result.files.every((name) => !name.startsWith('cms/')));
  const catalog = JSON.parse(await readFile(path.join(outDir, 'content.json'), 'utf8'));
  assert.equal(catalog.items[0].cover, `/deedee-studio-static/assets/cms/${file}`);
  await mkdir(path.join(outDir, 'post', 'archived'), { recursive: true }); await writeFile(path.join(outDir, 'post', 'archived', 'index.html'), 'keep');
  const removed = await exportContent({ ...args, previousItems: [published], items: [] });
  assert.ok(removed.files.includes('post/bai-moi/index.html'));
  await assert.rejects(access(path.join(outDir, 'post', 'bai-moi', 'index.html')));
  assert.equal(await readFile(path.join(outDir, 'post', 'archived', 'index.html'), 'utf8'), 'keep');
});
