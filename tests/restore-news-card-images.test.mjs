import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  collectArchiveCardSources,
  newsCardImageUrl,
  planNewsCardImages,
  restoreNewsCardImages,
} from '../scripts/restore-news-card-images.mjs';
import { wideCardImage } from '../scripts/news-pagination.mjs';

const media = id => `https://static.wixstatic.com/media/${id}`;
const square = id => `${media(id)}/v1/fill/w_400,h_400,fp_0.50_0.50,q_90,enc_avif,quality_auto/${id}`;
const wide = (id, w, h) => `${media(id)}/v1/fill/w_${w},h_${h},fp_0.50_0.50,q_90,enc_avif,quality_auto/${id}`;
const card = src => `<img data-hook="gallery-item-image-img" src="${src}">`;

const assets = {
  [square('aaa_1~mv2.jpg')]: '/assets/sq-a.jpg',
  [wide('aaa_1~mv2.jpg', 934, 526)]: '/assets/wide-a.jpg',
  [square('bbb_2~mv2.png')]: '/assets/sq-b.png',
  [wide('bbb_2~mv2.png', 467, 263)]: '/assets/too-small-b.png',
  [square('ccc_3~mv2.jpg')]: '/assets/sq-c.jpg',
  [wide('ccc_3~mv2.jpg', 800, 800)]: '/assets/not-16x9-c.jpg',
};
const html = [
  `<div>${card('/deedee-studio-static/assets/sq-a.jpg')}${card('/deedee-studio-static/assets/sq-b.png')}</div>`,
  `<div>${card('/deedee-studio-static/assets/sq-c.jpg')}${card('https://static.wixstatic.com/media/zzz_9~mv2.png/v1/fill/w_400,h_400/zzz_9~mv2.png')}<img src="/assets/ignored.jpg"></div>`,
];

test('collectArchiveCardSources only returns gallery card images', () => {
  assert.deepEqual(collectArchiveCardSources(html[1]), [
    '/deedee-studio-static/assets/sq-c.jpg',
    'https://static.wixstatic.com/media/zzz_9~mv2.png/v1/fill/w_400,h_400/zzz_9~mv2.png',
  ]);
});

test('plan reuses a wide local 16:9 variant and schedules a download otherwise', () => {
  const plan = planNewsCardImages(html, assets);
  assert.equal(plan.images['sq-a.jpg'], 'wide-a.jpg');
  assert.match(plan.images['sq-b.png'], /^news-card-[0-9a-f]{24}\.avif$/);
  assert.match(plan.images['sq-c.jpg'], /^news-card-[0-9a-f]{24}\.avif$/);
  assert.deepEqual(plan.downloads.map(item => item.uri).sort(), ['bbb_2~mv2.png', 'ccc_3~mv2.jpg', 'zzz_9~mv2.png']);
  assert.ok(plan.downloads.every(item => item.url === newsCardImageUrl(item.uri)));
  // A card that still points at the remote Wix thumbnail is keyed by that full URL.
  const remoteKey = 'https://static.wixstatic.com/media/zzz_9~mv2.png/v1/fill/w_400,h_400/zzz_9~mv2.png';
  assert.match(plan.images[remoteKey], /^news-card-[0-9a-f]{24}\.avif$/);
  assert.deepEqual(plan.unresolved, []);
});

test('only Wix media basenames can become download URLs', () => {
  assert.equal(
    newsCardImageUrl('aaa_1~mv2.jpg'),
    'https://static.wixstatic.com/media/aaa_1~mv2.jpg/v1/fill/w_804,h_452,fp_0.50_0.50,q_90,enc_avif,quality_auto/aaa_1~mv2.jpg',
  );
  assert.throws(() => newsCardImageUrl('../etc/passwd'), /Invalid Wix media basename/);
  assert.throws(() => newsCardImageUrl('https://evil.example/x.png'), /Invalid Wix media basename/);
});

test('wideCardImage swaps only mapped basenames and keeps the path prefix', () => {
  const map = { 'sq-a.jpg': 'wide-a.avif' };
  assert.equal(wideCardImage('/deedee-studio-static/assets/sq-a.jpg', map), '/deedee-studio-static/assets/wide-a.avif');
  assert.equal(wideCardImage('/deedee-studio-static/assets/other.jpg', map), '/deedee-studio-static/assets/other.jpg');
  assert.equal(wideCardImage('/assets/toString', map), '/assets/toString');
  assert.equal(wideCardImage('/assets/sq-a.jpg'), '/assets/sq-a.jpg');
});

async function fixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'news-images-'));
  await mkdir(path.join(root, 'news'), { recursive: true });
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ assets }, null, 2));
  for (const [index, file] of ['blog/categories/hoạt-động/index.html', 'blog/categories/talk-interview/index.html', 'blog/categories/knowledge/index.html'].entries()) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), html[Math.min(index, 1)]);
  }
  return root;
}

const imageResponse = bytes => new Response(bytes, { status: 200, headers: { 'content-type': 'image/avif' } });

test('dry run reports the plan without downloading or writing', async () => {
  const root = await fixtureRoot();
  let calls = 0;
  const result = await restoreNewsCardImages({ root, dryRun: true, fetchImpl: async () => { calls += 1; return imageResponse(new Uint8Array(4)); } });
  assert.equal(calls, 0);
  assert.equal(result.toDownload, 3);
  assert.equal(result.reused, 1);
  await assert.rejects(readFile(path.join(root, 'news/card-images.json')));
});

test('restore downloads missing images, extends the manifest and writes the mapping', async () => {
  const root = await fixtureRoot();
  const requested = [];
  const result = await restoreNewsCardImages({
    root,
    fetchImpl: async (url, options) => {
      requested.push(url);
      assert.equal(options.redirect, 'error');
      return imageResponse(new Uint8Array([1, 2, 3, 4]));
    },
  });
  assert.equal(result.downloaded, 3);
  assert.ok(requested.every(url => url.startsWith('https://static.wixstatic.com/media/')));
  const mapping = JSON.parse(await readFile(path.join(root, 'news/card-images.json'), 'utf8'));
  assert.equal(Object.keys(mapping.images).length, 4);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.ok(requested.every(url => manifest.assets[url]?.startsWith('/assets/news-card-')));
  // A second run has nothing left to download.
  const again = await restoreNewsCardImages({ root, fetchImpl: async () => { throw new Error('unexpected request'); } });
  assert.equal(again.downloaded, 0);
});

test('a failed or non-image response aborts before anything is written', async () => {
  const root = await fixtureRoot();
  await assert.rejects(
    restoreNewsCardImages({ root, fetchImpl: async () => new Response('nope', { status: 200, headers: { 'content-type': 'text/html' } }) }),
    /not an image/,
  );
  await assert.rejects(readFile(path.join(root, 'news/card-images.json')));
});

test('wideCardImage swaps a remote Wix thumbnail for the local 16:9 asset', () => {
  const remote = 'https://static.wixstatic.com/media/zzz_9~mv2.png/v1/fill/w_400,h_400/zzz_9~mv2.png';
  const swapped = wideCardImage(remote, { [remote]: 'news-card-abc.avif' });
  assert.match(swapped, /\/assets\/news-card-abc\.avif$/);
  assert.equal(wideCardImage(remote, {}), remote, 'unmapped remote URLs are left alone');
});
