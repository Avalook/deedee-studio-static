import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createStore, StoreConflictError } from '../lib/store.mjs';
import { SEED_DIR } from '../lib/config.mjs';

const DEMO_USERS = [
  { id: 'user_editor', username: 'editor', role: 'editor', password: 'editor-test' },
  { id: 'user_publisher', username: 'publisher', role: 'publisher', password: 'publisher-test' },
];

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV0fWQAAAABJRU5ErkJggg==',
  'base64',
);

async function withStore(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cms-poc-store-'));
  try {
    const store = await createStore({ dataDir: dir, seedDir: SEED_DIR, demoUsers: DEMO_USERS });
    await fn(store, dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('seeds a draft, a release and demo users', async () => {
  await withStore(async (store) => {
    const draft = await store.getDraftRevision();
    const release = await store.getPublishedRelease();
    assert.ok(draft);
    assert.ok(release);
    assert.equal(release.revisionId, draft.id);
    assert.deepEqual(draft.projectData, { schemaVersion: 1, pageId: '/', operations: [], insertions: [] });
    assert.deepEqual(release.siteDocument, draft.projectData);

    const editor = store.authenticate('editor', 'editor-test');
    assert.equal(editor.role, 'editor');
    assert.equal(store.authenticate('editor', 'wrong'), null);
    assert.equal(store.authenticate('missing', 'editor-test'), null);
  });
});

test('creates revisions and rejects a stale base revision', async () => {
  await withStore(async (store) => {
    const first = await store.getDraftRevision();

    await assert.rejects(
      store.createRevision({
        html: '<p>stale</p>',
        css: '',
        projectData: {},
        createdBy: 'editor',
        baseRevisionId: 'rev_00000000-0000-0000-0000-000000000000',
      }),
      StoreConflictError,
    );

    const saved = await store.createRevision({
      html: '<p>first</p>',
      css: 'p { color: red; }',
      projectData: { pages: [] },
      createdBy: 'editor',
      baseRevisionId: first.id,
    });

    assert.notEqual(saved.id, first.id);
    assert.equal(saved.baseRevisionId, first.id);
    assert.equal((await store.getDraftRevision()).id, saved.id);
    assert.equal((await store.getPublishedRelease()).revisionId, first.id);
  });
});

test('publishes a revision without deleting history', async () => {
  await withStore(async (store) => {
    const first = await store.getDraftRevision();
    const second = await store.createRevision({
      html: '<p>second</p>',
      css: '',
      projectData: {},
      createdBy: 'editor',
      baseRevisionId: first.id,
    });

    const release = await store.publishRevision(second.id, 'publisher');
    assert.equal(release.revisionId, second.id);
    assert.equal((await store.getPublishedRelease()).id, release.id);
    assert.deepEqual(release.siteDocument, second.projectData);

    const revisions = await store.listRevisions();
    assert.ok(revisions.some((revision) => revision.id === first.id));
    assert.ok(revisions.some((revision) => revision.id === second.id));
  });
});

test('restores an old revision as a new draft and keeps history', async () => {
  await withStore(async (store) => {
    const first = await store.getDraftRevision();
    const second = await store.createRevision({
      html: '<p>second</p>',
      css: '',
      projectData: {},
      createdBy: 'editor',
      baseRevisionId: first.id,
    });

    const restored = await store.restoreRevisionAsDraft(first.id, 'editor');
    assert.notEqual(restored.id, first.id);
    assert.notEqual(restored.id, second.id);
    assert.equal(restored.html, first.html);
    assert.equal((await store.getDraftRevision()).id, restored.id);

    const revisions = await store.listRevisions();
    assert.equal(revisions.length, 3);
  });
});

test('stores uploaded images with generated names and gates unpublished media', async () => {
  await withStore(async (store) => {
    const asset = await store.addAsset({
      buffer: PNG,
      mime: 'image/png',
      ext: 'png',
      originalName: '../unsafe name.png',
      actor: 'editor',
    });

    assert.match(asset.file, /^[a-f0-9-]{36}\.png$/);
    assert.equal(asset.name, '.._unsafe name.png');
    assert.equal(store.listAssets()[0].src, `/media/${asset.file}`);

    const info = await store.getAssetFile(asset.file);
    assert.ok(info);
    assert.equal(info.asset.type, 'image/png');
    assert.equal(await store.isAssetPublished(asset.file), false);

    const draft = await store.getDraftRevision();
    const saved = await store.createRevision({
      html: `<p><img src="/media/${asset.file}" alt="Uploaded"></p>`,
      css: '',
      projectData: { schemaVersion: 1, pageId: '/', operations: [], insertions: [] },
      createdBy: 'editor',
      baseRevisionId: draft.id,
    });
    await store.publishRevision(saved.id, 'publisher');

    assert.equal(await store.isAssetPublished(asset.file), true);
  });
});
