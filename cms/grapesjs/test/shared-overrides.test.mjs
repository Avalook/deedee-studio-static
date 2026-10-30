import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { createStore } from '../lib/store.mjs';
import { SEED_DIR } from '../lib/config.mjs';
import { syncRepository } from '../lib/hosted-repository.mjs';
import { adoptPublishedOverrides, localisePublishedMedia, parsePublished, publishedElsewhere } from '../lib/shared-overrides.mjs';

const USERS = [{ id: 'user_publisher', username: 'publisher', role: 'publisher', password: 'publisher-test' }];
const REVISION = 'rev_11111111-1111-1111-1111-111111111111';
const FILE = '22222222-2222-2222-2222-222222222222.mp4';
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
  await writeFile(path.join(outDir, 'assets', 'cms', FILE), 'video');
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
  assert.equal(await adoptPublishedOverrides({ store, outDir, uploadsDir }), REVISION);
  const release = await store.getPublishedRelease();
  assert.equal(release.revisionId, REVISION);
  assert.equal(release.siteDocument.pages['/aboutus'].operations[0].text, 'Đã xuất bản');
  assert.equal((await store.getDraftRevision()).id, REVISION);
  assert.equal(await readFile(path.join(uploadsDir, FILE), 'utf8'), 'video');
  assert.equal(await adoptPublishedOverrides({ store, outDir, uploadsDir }), null, 'adopting twice changes nothing');
});

test('adopting keeps draft pages that were not published yet', async (t) => {
  const { outDir, store, uploadsDir } = await install(t);
  const draft = await store.getDraftRevision();
  const pages = { '/service': page('/service', [{ selector: 'h1', text: 'Nháp chưa đăng' }]) };
  await store.createRevision({ html: draft.html, css: draft.css, projectData: { schemaVersion: 1, pages },
    createdBy: 'publisher', baseRevisionId: draft.id });
  await adoptPublishedOverrides({ store, outDir, uploadsDir });
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
