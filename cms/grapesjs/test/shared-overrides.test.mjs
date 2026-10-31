import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { createStore } from '../lib/store.mjs';
import { SEED_DIR } from '../lib/config.mjs';
import { syncRepository } from '../lib/hosted-repository.mjs';
import { createContentStore } from '../lib/content-store.mjs';
import { adoptPublishedContent, adoptPublishedOverrides, localisePublishedMedia, parsePublished, publishedElsewhere } from '../lib/shared-overrides.mjs';

const USERS = [{ id: 'user_publisher', username: 'publisher', role: 'publisher', password: 'publisher-test' }];
const REVISION = 'rev_11111111-1111-1111-1111-111111111111';
const FILE = '22222222-2222-2222-2222-222222222222.mp4';
const VIDEO = Buffer.from('\0\0\0\x18ftypmp42');
const page = (pageId, operations = [], insertions = []) => ({ schemaVersion: 1, pageId, operations, insertions });
const published = (revisionId = REVISION) => ({ version: 1, revisionId, publishedAt: '2026-10-30T00:00:00.000Z', publishedBy: 'admin', pages: {
  '/aboutus': page('/aboutus', [{ selector: 'h1', text: 'Đã xuất bản' }],
    [{ id: 'add_55555555-5555-5555-5555-555555555555', type: 'video', video: `/deedee-studio-static/assets/cms/${FILE}` }]),
} });

async function install(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cms-shared-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outDir = path.join(root, 'site');
  await mkdir(path.join(outDir, 'assets', 'cms'), { recursive: true });
  await writeFile(path.join(outDir, 'assets', 'cms', FILE), VIDEO);
  await writeFile(path.join(outDir, 'site-overrides.json'), JSON.stringify(published()));
  const dataDir = path.join(root, 'data');
  const store = await createStore({ dataDir, seedDir: SEED_DIR, demoUsers: USERS });
  return { root, outDir, store, uploadsDir: path.join(dataDir, 'uploads') };
}

test('published media goes back to the references the editor uses', () => {
  const { pages, files } = localisePublishedMedia(published().pages);
  assert.equal(pages['/aboutus'].insertions[0].video, `/media/${FILE}`);
  assert.deepEqual(files, [FILE]);
});

test('an empty record is not a publication', () => {
  assert.equal(parsePublished('{"version":1,"revisionId":null,"pages":{}}'), null);
  assert.equal(parsePublished('not json'), null);
  assert.equal(parsePublished(JSON.stringify(published())).revisionId, REVISION);
});

test('a fresh install adopts what is published, so its first publish keeps earlier edits', async (t) => {
  const { outDir, store, uploadsDir } = await install(t);
  assert.equal(await adoptPublishedOverrides({ store, outDir }), REVISION);
  const release = await store.getPublishedRelease();
  assert.equal(release.revisionId, REVISION);
  assert.equal(release.siteDocument.pages['/aboutus'].operations[0].text, 'Đã xuất bản');
  assert.equal((await store.getDraftRevision()).id, REVISION);
  assert.deepEqual(await readFile(path.join(uploadsDir, FILE)), VIDEO);
  assert.equal((await store.getAssetFile(FILE)).asset.type, 'video/mp4', 'the editor can serve it');
  assert.equal(await adoptPublishedOverrides({ store, outDir }), null, 'adopting twice changes nothing');
});

test('adopting keeps draft pages that were not published yet', async (t) => {
  const { outDir, store } = await install(t);
  const draft = await store.getDraftRevision();
  const pages = { '/service': page('/service', [{ selector: 'h1', text: 'Nháp chưa đăng' }]) };
  await store.createRevision({ html: draft.html, css: draft.css, projectData: { schemaVersion: 1, pages },
    createdBy: 'publisher', baseRevisionId: draft.id });
  await adoptPublishedOverrides({ store, outDir });
  const merged = (await store.getDraftRevision()).projectData.pages;
  assert.equal(merged['/service'].operations[0].text, 'Nháp chưa đăng');
  assert.equal(merged['/aboutus'].operations[0].text, 'Đã xuất bản');
  assert.equal((await store.getPublishedRelease()).siteDocument.pages['/service'], undefined);
});

test('a publication from another machine is noticed before this one overwrites it', async (t) => {
  const { root, store } = await install(t);
  const git = (args, cwd = root) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString();
  const remote = path.join(root, 'remote.git');
  const seed = path.join(root, 'seed-repo');
  const checkout = path.join(root, 'checkout');
  git(['init', '--bare', '--initial-branch=main', remote]);
  await mkdir(seed);
  git(['init', '--initial-branch=main'], seed);
  git(['config', 'user.name', 'Test'], seed);
  git(['config', 'user.email', 'test@example.com'], seed);
  const commit = async (revisionId) => {
    await writeFile(path.join(seed, 'site-overrides.json'), JSON.stringify(published(revisionId)));
    git(['add', '.'], seed);
    git(['commit', '-m', revisionId], seed);
    git(['push', remote, 'HEAD:main'], seed);
  };
  await commit('rev_33333333-3333-3333-3333-333333333333');
  git(['clone', remote, checkout]);
  await syncRepository(checkout);
  assert.equal(await publishedElsewhere({ store, repoDir: checkout }), true);
  await store.adoptRelease({ revisionId: 'rev_33333333-3333-3333-3333-333333333333', pages: {} });
  assert.equal(await publishedElsewhere({ store, repoDir: checkout }), false);
  await commit('rev_44444444-4444-4444-4444-444444444444');
  await syncRepository(checkout);
  assert.equal(await publishedElsewhere({ store, repoDir: checkout }), true);
});

const CONTENT_ID = 'content_33333333-3333-3333-3333-333333333333';
const LOCAL_ID = 'content_44444444-4444-4444-4444-444444444444';
const COVER = '66666666-6666-6666-6666-666666666666.png';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const article = (id, slug, title) => ({ id, type: 'article', language: 'vi', slug, title, route: `/post/${slug}`,
  cover: `/deedee-studio-static/assets/cms/${COVER}`, publishedAt: '2026-10-30T00:00:00.000Z' });

async function contentInstall(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cms-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outDir = path.join(root, 'site'); const dataDir = path.join(root, 'data');
  await mkdir(path.join(outDir, 'assets', 'cms'), { recursive: true });
  await writeFile(path.join(outDir, 'assets', 'cms', COVER), PNG);
  const store = await createStore({ dataDir, seedDir: SEED_DIR, demoUsers: USERS });
  const contentStore = await createContentStore({ dataDir, staticSiteDir: outDir, publicCatalogFile: path.join(outDir, 'content.json') });
  const catalog = (items) => writeFile(path.join(outDir, 'content.json'), JSON.stringify({ version: 1, items }));
  return { outDir, store, contentStore, catalog };
}

test('an existing install adopts articles published elsewhere and keeps its own drafts', async (t) => {
  const { outDir, store, contentStore, catalog } = await contentInstall(t);
  const draft = await contentStore.create({ type: 'article', language: 'vi', slug: 'nhap', title: 'Nháp của máy này' });
  await catalog([article(CONTENT_ID, 'bai-may-khac', 'Bài máy khác')]);
  await adoptPublishedContent({ store, contentStore, outDir });
  const [own, adopted] = await contentStore.list();
  assert.equal(own.id, draft.id); assert.equal(own.status, 'draft');
  assert.equal(adopted.status, 'published'); assert.equal(adopted.cover, `/media/${COVER}`);
  assert.ok(await store.getAssetFile(COVER), 'the editor can show the cover');
  await assert.rejects(contentStore.update(adopted.id, { slug: 'nhap' }), (error) => error.code === 'ROUTE_CONFLICT');
});

test('adoption follows later edits and removals, without losing unpublished work', async (t) => {
  const { outDir, store, contentStore, catalog } = await contentInstall(t);
  const adopt = () => adoptPublishedContent({ store, contentStore, outDir });
  await catalog([article(CONTENT_ID, 'bai-a', 'Bản đầu'), article(LOCAL_ID, 'bai-b', 'Bản đầu')]);
  await adopt();
  await contentStore.update(LOCAL_ID, { title: 'Đang sửa dở' });
  await catalog([article(CONTENT_ID, 'bai-a', 'Máy khác đã sửa'), article(LOCAL_ID, 'bai-b', 'Máy khác đã sửa')]);
  await adopt();
  assert.equal((await contentStore.get(CONTENT_ID)).title, 'Máy khác đã sửa');
  const edited = await contentStore.get(LOCAL_ID);
  assert.equal(edited.title, 'Đang sửa dở'); assert.equal(edited.status, 'changed'); assert.equal(edited.publishedItem.title, 'Máy khác đã sửa');
  await catalog([article(LOCAL_ID, 'bai-b', 'Máy khác đã sửa')]);
  await adopt();
  const removed = await contentStore.get(CONTENT_ID);
  assert.equal(removed.status, 'draft'); assert.equal(removed.title, 'Máy khác đã sửa');
  await assert.rejects(contentStore.update(CONTENT_ID, { slug: 'duong-dan-moi' }), (error) => error.code === 'ROUTE_CONFLICT');
  assert.equal((await contentStore.published()).length, 1);
});

test('a draft cannot be published over an article that another machine put on the same route', async (t) => {
  const { outDir, store, contentStore, catalog } = await contentInstall(t);
  const draft = await contentStore.create({ type: 'article', language: 'vi', slug: 'trung-duong-dan', title: 'Nháp' });
  await catalog([article(CONTENT_ID, 'trung-duong-dan', 'Đã đăng ở máy khác')]);
  await adoptPublishedContent({ store, contentStore, outDir });
  await assert.rejects(contentStore.assertPublishable(draft.id), (error) => error.code === 'ROUTE_CONFLICT');
  await contentStore.assertPublishable(CONTENT_ID);
});

test('a missing or broken catalog changes nothing', async (t) => {
  const { outDir, store, contentStore } = await contentInstall(t);
  await adoptPublishedContent({ store, contentStore, outDir });
  await writeFile(path.join(outDir, 'content.json'), 'not json');
  await adoptPublishedContent({ store, contentStore, outDir });
  await writeFile(path.join(outDir, 'content.json'), JSON.stringify({ version: 2, items: [] }));
  await adoptPublishedContent({ store, contentStore, outDir });
  assert.deepEqual(await contentStore.list(), []);
});
