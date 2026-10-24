import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  collectPlaceholders,
  originalMediaUrl,
  replaceAssetReferences,
  restorePlaceholderAssets,
} from '../scripts/restore-placeholder-assets.mjs';

const uri = '7181ac_original~mv2.png';
const old = '/assets/captured-blur.png';
const remote = `https://static.wixstatic.com/media/${uri}/v1/fill/w_60,h_74,blur_2/${uri}`;
const assets = { [remote]: old };
const info = JSON.stringify({ imageData: { uri } }).replaceAll('"', '&quot;');
const image = `<wow-image data-image-info="${info}"><picture><source srcset="/deedee-studio-static${old} 2x"><img src="/deedee-studio-static${old}"></picture></wow-image>`;

test('constructs original URLs solely from a validated Wix media basename', () => {
  assert.equal(originalMediaUrl(uri), `https://static.wixstatic.com/media/${uri}`);
  for (const invalid of ['../a.png', 'https://other/a.png', 'a.png?x=1', 'a.svg', 'a%2f.png', '', null]) {
    assert.throws(() => originalMediaUrl(invalid), /media basename/i);
  }
});

test('finds blurred img descendants through picture without changing input data', () => {
  const inputAssets = Object.freeze({ ...assets });
  const result = collectPlaceholders(image, inputAssets);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { uri, old, remote });
  assert.deepEqual(inputAssets, assets);
});

test('skips images without metadata, unblurred sources and unrelated script markup', () => {
  const unblurred = { [remote.replace('blur_2', 'quality_auto')]: old };
  assert.deepEqual(collectPlaceholders(image, unblurred), []);
  assert.deepEqual(collectPlaceholders(`<script>const html = '${image}';</script><img src="${old}">`, assets), []);
  assert.deepEqual(collectPlaceholders('<wow-image><img src="missing.png"></wow-image>', assets), []);
});

test('replaces precise references including project-prefix srcset and preserves nearby paths', () => {
  const html = `${image}<img src="${old}.bak"><img src="/assets/unrelated.png">`;
  const result = replaceAssetReferences(html, [{ old, local: '/assets/source-new.png' }]);
  assert.match(result, /srcset="\/deedee-studio-static\/assets\/source-new.png 2x"/);
  assert.match(result, /src="\/deedee-studio-static\/assets\/source-new.png"/);
  assert.match(result, /captured-blur.png.bak/);
  assert.match(result, /\/assets\/unrelated.png/);
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-placeholder-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'en'));
  await writeFile(path.join(root, 'index.html'), image);
  await writeFile(path.join(root, 'en/index.html'), image);
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ assets, untouched: 'retained' }));
  return root;
}

test('downloads originals once before repairing home pages and keeps manifest mappings', async t => {
  const root = await fixture(t);
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), image);
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } });
  };
  const report = await restorePlaceholderAssets({ root, fetchImpl });
  assert.equal(report.pagesChanged, 2);
  assert.equal(report.placeholderOccurrences, 2);
  assert.equal(report.restoredOriginals, 1);
  assert.deepEqual(calls, [`https://static.wixstatic.com/media/${uri}`]);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.assets[remote], old);
  assert.equal(manifest.untouched, 'retained');
  const local = manifest.assets[originalMediaUrl(uri)];
  assert.match(local, /^\/assets\/source-[a-f0-9]{24}\.png$/);
  assert.deepEqual([...await readFile(path.join(root, local))], [137, 80, 78, 71]);
  assert.ok((await readFile(path.join(root, 'en/index.html'), 'utf8')).includes(local));
  const second = await restorePlaceholderAssets({ root, fetchImpl });
  assert.equal(second.restoredOriginals, 0);
  assert.equal(second.pagesChanged, 0);
  assert.equal(calls.length, 1);
});

for (const [name, response] of [
  ['HTTP error', () => new Response('missing', { status: 404 })],
  ['non-image', () => new Response('not image', { headers: { 'content-type': 'text/html' } })],
  ['excess size header', () => new Response('large', { headers: { 'content-type': 'image/png', 'content-length': '31457281' } })],
]) {
  test(`leaves home HTML and manifest unchanged after ${name}`, async t => {
    const root = await fixture(t);
    const before = await readFile(path.join(root, 'manifest.json'), 'utf8');
    await assert.rejects(restorePlaceholderAssets({ root, fetchImpl: async () => response() }));
    assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), image);
    assert.equal(await readFile(path.join(root, 'en/index.html'), 'utf8'), image);
    assert.equal(await readFile(path.join(root, 'manifest.json'), 'utf8'), before);
  });
}

test('rejects a response whose streamed body exceeds the image limit', async t => {
  const root = await fixture(t);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(30 * 1024 * 1024));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  });
  await assert.rejects(restorePlaceholderAssets({ root, fetchImpl: async () => new Response(stream, { headers: { 'content-type': 'image/png' } }) }), /size limit/i);
  assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), image);
});
