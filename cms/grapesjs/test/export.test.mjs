import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { collectPageDocuments, exportStaticSite, rewriteUploadedMedia } from '../lib/export.mjs';
import { commitAndPush } from '../lib/git-publish.mjs';

const FILE = '0f6f6e9a-1b0e-4f1e-9f45-6f4b8c1d2e3a.png';

const page = (pageId, operations = [], insertions = []) => ({ schemaVersion: 1, pageId, operations, insertions });
const textOp = (selector, text) => ({ selector, text });
const release = siteDocument => ({ revisionId: 'rev_x', publishedAt: '2026-10-26T00:00:00.000Z', publishedBy: 'publisher', siteDocument });

async function tmp(prefix) { return fs.mkdtemp(path.join(os.tmpdir(), prefix)); }

test('collects only valid pages that actually change something', () => {
  const pages = collectPageDocuments({
    schemaVersion: 1,
    pages: {
      '/aboutus': page('/aboutus', [textOp('#comp-a', 'Xin chào')]),
      '/empty': page('/empty'),
      '/bad': { schemaVersion: 2, pageId: '/bad', operations: [], insertions: [] },
    },
  });
  assert.deepEqual(Object.keys(pages), ['/aboutus']);
});

test('accepts a legacy single-page document', () => {
  const pages = collectPageDocuments(page('/', [textOp('#comp-a', 'Home')]));
  assert.deepEqual(Object.keys(pages), ['/']);
  assert.deepEqual(collectPageDocuments(null), {});
});

test('uploaded images are rewritten to the static asset path', () => {
  const input = { '/x': page('/x', [{ selector: '#img', image: `/media/${FILE}` }]) };
  const { pages, files } = rewriteUploadedMedia(input);
  assert.deepEqual(files, [FILE]);
  assert.equal(pages['/x'].operations[0].image, `/deedee-studio-static/assets/cms/${FILE}`);
  assert.equal(input['/x'].operations[0].image, `/media/${FILE}`, 'input is not mutated');
});

test('export writes the overrides, the runtime and referenced uploads, atomically', async () => {
  const out = await tmp('cms-out-');
  const uploads = await tmp('cms-up-');
  const runtime = path.join(await tmp('cms-rt-'), 'cms-runtime.js');
  await fs.writeFile(runtime, '/* runtime */');
  await fs.writeFile(path.join(uploads, FILE), Buffer.from([1, 2, 3]));
  const result = await exportStaticSite({
    release: release({ schemaVersion: 1, pages: { '/aboutus': page('/aboutus', [textOp('#comp-a', 'Xin chào'), { selector: '#img', image: `/media/${FILE}` }]) } }),
    outDir: out, uploadsDir: uploads, runtimeFile: runtime,
  });
  assert.equal(result.pages, 1);
  assert.equal(result.operations, 2);
  assert.deepEqual(result.media, [FILE]);
  const written = JSON.parse(await fs.readFile(path.join(out, 'site-overrides.json'), 'utf8'));
  assert.equal(written.revisionId, 'rev_x');
  assert.equal(written.pages['/aboutus'].operations[0].text, 'Xin chào');
  assert.equal(written.pages['/aboutus'].operations[1].image, `/deedee-studio-static/assets/cms/${FILE}`);
  assert.equal(await fs.readFile(path.join(out, 'scripts', 'cms-runtime.js'), 'utf8'), '/* runtime */');
  assert.deepEqual([...await fs.readFile(path.join(out, 'assets', 'cms', FILE))], [1, 2, 3]);
  assert.deepEqual((await fs.readdir(out)).filter(name => name.endsWith('.tmp')), []);
});

test('a missing upload fails rather than publishing a broken image URL', async () => {
  const out = await tmp('cms-out-');
  const runtime = path.join(await tmp('cms-rt-'), 'cms-runtime.js');
  await fs.writeFile(runtime, 'x');
  await assert.rejects(exportStaticSite({
    release: release({ schemaVersion: 1, pages: { '/x': page('/x', [{ selector: '#img', image: `/media/${FILE}` }]) } }),
    outDir: out, uploadsDir: await tmp('cms-up-'), runtimeFile: runtime,
  }), /Referenced upload is missing/);
});

test('publishing an older revision replaces the overrides, including with none', async () => {
  const out = await tmp('cms-out-');
  const runtime = path.join(await tmp('cms-rt-'), 'cms-runtime.js');
  await fs.writeFile(runtime, 'x');
  const args = { outDir: out, uploadsDir: await tmp('cms-up-'), runtimeFile: runtime };
  await exportStaticSite({ ...args, release: release({ schemaVersion: 1, pages: { '/a': page('/a', [textOp('#comp-a', 'A')]) } }) });
  await exportStaticSite({ ...args, release: release({ schemaVersion: 1, pages: {} }) });
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(out, 'site-overrides.json'), 'utf8')).pages, {});
});

function git(cwd, ...args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }); }

test('commitAndPush stages only the exported files and skips an empty commit', async () => {
  const repo = await tmp('cms-git-');
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 'cms@example.invalid');
  git(repo, 'config', 'user.name', 'CMS test');
  await fs.writeFile(path.join(repo, 'site-overrides.json'), '{}');
  await fs.writeFile(path.join(repo, 'unrelated.txt'), 'keep me out');
  const first = await commitAndPush({ repoDir: repo, files: ['site-overrides.json'], message: 'cms: publish', push: false });
  assert.deepEqual(first, { committed: true, pushed: false });
  assert.equal(git(repo, 'show', '--stat', '--format=', 'HEAD').includes('unrelated.txt'), false);
  assert.match(git(repo, 'status', '--porcelain'), /\?\? unrelated\.txt/);
  const again = await commitAndPush({ repoDir: repo, files: ['site-overrides.json'], message: 'cms: publish', push: false });
  assert.deepEqual(again, { committed: false, pushed: false });
});
