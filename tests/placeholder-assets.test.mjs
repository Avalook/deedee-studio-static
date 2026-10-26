import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  collectPlaceholders,
  collectMissingImageSources,
  originalMediaUrl,
  replaceMissingImageSources,
  replaceAssetReferences,
  restorePlaceholderAssets,
} from '../scripts/restore-placeholder-assets.mjs';

const uri = '7181ac_original~mv2.png';
const old = '/assets/captured-blur.png';
const remote = `https://static.wixstatic.com/media/${uri}/v1/fill/w_60,h_74,blur_2/${uri}`;
const assets = { [remote]: old };
const info = JSON.stringify({ imageData: { uri, width: 1600, height: 900, hasAnimation: false } }).replaceAll('"', '&quot;');
const image = `<wow-image data-image-info="${info}"><picture><source srcset="/deedee-studio-static${old} 2x"><img src="/deedee-studio-static${old}"></picture></wow-image>`;
const missingImage = `<wow-image data-image-info="${info}"><picture><img src="" alt="project"></picture></wow-image>`;

const animUri = '7181ac_anim~mv2.webp';
const animOld = '/assets/animated-blur.png';
const animRemote = `https://static.wixstatic.com/media/${animUri}/v1/fill/w_60,h_74,blur_2/${animUri}`;
const nestedOnlyInfo = JSON.stringify({ imageData: { uri: animUri, width: 800, height: 600, hasAnimation: true } }).replaceAll('"', '&quot;');
const topLevelInfo = JSON.stringify({ containerId: 'comp-abcd', hasAnimation: true, imageData: { uri: animUri, width: 800, height: 600 } }).replaceAll('"', '&quot;');
const topLevelFalseInfo = JSON.stringify({ hasAnimation: false, imageData: { uri: animUri, width: 800, height: 600, hasAnimation: true } }).replaceAll('"', '&quot;');
const topLevelAnimatedImage = `<wow-image data-image-info="${topLevelInfo}"><img src="/deedee-studio-static${animOld}"></wow-image>`;

const otherUri = '9f0d0_other~mv2.png';
const otherOld = '/assets/other-blur.png';
const otherRemote = `https://static.wixstatic.com/media/${otherUri}/v1/fill/w_60,h_74,blur_2/${otherUri}`;

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
  assert.deepEqual(result[0], { uri, old, remote, width: 1600, height: 900, hasAnimation: false });
  assert.deepEqual(inputAssets, assets);
});

test('skips images without metadata, unblurred sources and unrelated script markup', () => {
  const unblurred = { [remote.replace('blur_2', 'quality_auto')]: old };
  assert.deepEqual(collectPlaceholders(image, unblurred), []);
  assert.deepEqual(collectPlaceholders(`<script>const html = '${image}';</script><img src="${old}">`, assets), []);
  assert.deepEqual(collectPlaceholders('<wow-image><img src="missing.png"></wow-image>', assets), []);
});

test('reads hasAnimation from the real top-level data-image-info flag with nested fallback', () => {
  const animAssets = { [animRemote]: animOld };
  const [topLevel] = collectPlaceholders(topLevelAnimatedImage, animAssets);
  assert.equal(topLevel.hasAnimation, true);
  const [nested] = collectPlaceholders(`<wow-image data-image-info="${nestedOnlyInfo}"><img src="${animOld}"></wow-image>`, animAssets);
  assert.equal(nested.hasAnimation, true);
  const [falseTop] = collectPlaceholders(`<wow-image data-image-info="${topLevelFalseInfo}"><img src="${animOld}"></wow-image>`, animAssets);
  assert.equal(falseTop.hasAnimation, false);
  const [blank] = collectMissingImageSources(`<wow-image data-image-info="${topLevelInfo}"><img src=""></wow-image>`);
  assert.equal(blank.hasAnimation, true);
});

test('collects only blurred source candidates serving the wow-image uri and keeps sibling srcset entries', () => {
  const combined = { ...assets, [otherRemote]: otherOld };
  const html = `<wow-image data-image-info="${info}"><picture><source media="(min-width: 320px) and (max-width: 750px)" type="image/avif" srcset="/deedee-studio-static${old} 320w, ${otherOld} 750w"><img src="/assets/already-sharp.avif"></picture></wow-image><wow-image><source srcset=""><img src=""></wow-image>`;
  const result = collectPlaceholders(html, combined);
  assert.deepEqual(result, [{ uri, old, remote, width: 1600, height: 900, hasAnimation: false }]);
  const rewritten = replaceAssetReferences(html, [{ old, local: '/assets/source-new.avif' }]);
  assert.match(rewritten, /media="\(min-width: 320px\) and \(max-width: 750px\)" type="image\/avif" srcset="\/deedee-studio-static\/assets\/source-new\.avif 320w, \/assets\/other-blur\.png 750w"/);
  assert.match(rewritten, /<img src="\/assets\/already-sharp\.avif">/);
  assert.match(rewritten, /<source srcset=""><img src=""><\/wow-image>/);
});

test('collects only empty Wix image sources with safe metadata and replaces their exact attributes', () => {
  const html = `${missingImage}<img src=""><wow-image><img src=""></wow-image>`;
  const refs = collectMissingImageSources(html);
  assert.equal(refs.length, 1);
  assert.equal(refs[0].uri, uri);
  assert.equal(html.slice(refs[0].start, refs[0].end), 'src=""');
  const result = replaceMissingImageSources(html, refs.map(ref => ({ ...ref, local: '/assets/restored.avif' })));
  assert.match(result, /<img src="\/assets\/restored\.avif" alt="project">/);
  assert.match(result, /<img src=""><\/wow-image>/);
  assert.match(result, /<img src=""><wow-image><img src=""><\/wow-image>/);
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

test('downloads optimized image variants once before repairing home pages and keeps manifest mappings', async t => {
  const root = await fixture(t);
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), image);
    return new Response(new Uint8Array([0, 0, 0, 0]), {
      headers: { 'content-type': 'image/avif' },
    });
  };
  const report = await restorePlaceholderAssets({ root, fetchImpl });
  assert.equal(report.pagesChanged, 2);
  assert.equal(report.placeholderOccurrences, 2);
  assert.equal(report.restoredOriginals, 1);
  const optimizedUrl = `https://static.wixstatic.com/media/${uri}/v1/fit/w_1600,h_900,q_90,enc_avif,quality_auto/${uri}`;
  assert.deepEqual(calls, [optimizedUrl]);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.assets[remote], old);
  assert.equal(manifest.untouched, 'retained');
  const local = manifest.assets[optimizedUrl];
  assert.ok(local.startsWith('/assets/source-') && local.endsWith('.avif'));
  assert.deepEqual([...await readFile(path.join(root, local))], [0, 0, 0, 0]);
  assert.ok((await readFile(path.join(root, 'en/index.html'), 'utf8')).includes(local));
  const second = await restorePlaceholderAssets({ root, fetchImpl });
  assert.equal(second.restoredOriginals, 0);
  assert.equal(second.pagesChanged, 0);
  assert.equal(calls.length, 1);
});

test('restores blank Wix image sources from metadata while keeping the deploy base path', async t => {
  const root = await fixture(t);
  const html = `${missingImage}<img src="/deedee-studio-static/assets/existing.avif"><wow-image><img src=""></wow-image>`;
  await writeFile(path.join(root, 'index.html'), html);
  await writeFile(path.join(root, 'en/index.html'), html);
  const calls = [];
  const report = await restorePlaceholderAssets({
    root,
    fetchImpl: async url => {
      calls.push(url);
      return new Response(new Uint8Array([0, 0, 0, 0]), {
        headers: { 'content-type': 'image/avif' },
      });
    },
  });

  assert.equal(report.pagesChanged, 2);
  assert.equal(report.missingImageSources, 2);
  assert.equal(report.restoredOriginals, 1);
  const optimizedUrl = `https://static.wixstatic.com/media/${uri}/v1/fit/w_1600,h_900,q_90,enc_avif,quality_auto/${uri}`;
  assert.deepEqual(calls, [optimizedUrl]);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const local = manifest.assets[optimizedUrl];
  const resultHtml = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(resultHtml, new RegExp(`<img src="/deedee-studio-static${local.replaceAll('/', '\\/')}" alt="project">`));
  assert.match(resultHtml, /<img src=""><\/wow-image>/);
});


test('restores placeholders from every manifest route, including project pages', async t => {
  const root = await fixture(t);
  const projectPage = 'all-project/example/index.html';
  await mkdir(path.dirname(path.join(root, projectPage)), { recursive: true });
  await writeFile(path.join(root, projectPage), image);

  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.pages = [
    { file: 'index.html' },
    { file: 'en/index.html' },
    { file: projectPage },
  ];
  await writeFile(manifestPath, JSON.stringify(manifest));

  const report = await restorePlaceholderAssets({
    root,
    fetchImpl: async () =>
      new Response(new Uint8Array([0, 0, 0, 0]), {
        headers: { 'content-type': 'image/avif' },
      }),
  });

  assert.equal(report.pagesChanged, 3);
  assert.equal(report.placeholderOccurrences, 3);
  assert.equal(report.restoredOriginals, 1);
  const html = await readFile(path.join(root, projectPage), 'utf8');
  assert.ok(html.includes('/assets/source-') && html.includes('.avif'));
});


test('preserves animated GIF sources instead of converting them to AVIF', async t => {
  const root = await fixture(t);
  const animatedUri = '7181ac_animated~mv2.gif';
  const animatedOld = '/assets/animated-blur.gif';
  const animatedRemote = `https://static.wixstatic.com/media/${animatedUri}/v1/fill/w_60,h_74,blur_2/${animatedUri}`;
  const animatedInfo = JSON.stringify({
    imageData: { uri: animatedUri, width: 600, height: 740, hasAnimation: true },
  }).replaceAll('"', '&quot;');
  const animatedImage = `<wow-image data-image-info="${animatedInfo}"><img src="/deedee-studio-static${animatedOld}"></wow-image>`;
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.assets = { [animatedRemote]: animatedOld };
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(path.join(root, 'index.html'), animatedImage);
  await writeFile(path.join(root, 'en/index.html'), animatedImage);

  const requests = [];
  await restorePlaceholderAssets({
    root,
    fetchImpl: async url => {
      requests.push(url);
      return new Response(new Uint8Array([71, 73, 70, 56]), {
        headers: { 'content-type': 'image/gif' },
      });
    },
  });

  assert.deepEqual(requests, [originalMediaUrl(animatedUri)]);
  const updatedManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.ok(updatedManifest.assets[originalMediaUrl(animatedUri)].endsWith('.gif'));
});

test('preserves top-level animated non-GIF formats instead of flattening them to AVIF', async t => {
  const root = await fixture(t);
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.assets = { [animRemote]: animOld };
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(path.join(root, 'index.html'), topLevelAnimatedImage);
  await writeFile(path.join(root, 'en/index.html'), topLevelAnimatedImage);
  const requests = [];
  await restorePlaceholderAssets({
    root,
    fetchImpl: async url => {
      requests.push(url);
      return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/webp' } });
    },
  });
  assert.deepEqual(requests, [originalMediaUrl(animUri)]);
  const updatedManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.ok(updatedManifest.assets[originalMediaUrl(animUri)].endsWith('.webp'));
});

test('repairs blurred mobile source candidates when the img src is already sharp', async t => {
  const root = await fixture(t);
  const html = `<wow-image data-image-info="${info}"><picture><source media="(min-width: 320px) and (max-width: 750px)" srcset="/deedee-studio-static${old} 320w"><img src="/assets/already-sharp.avif"></picture></wow-image>`;
  await writeFile(path.join(root, 'index.html'), html);
  await writeFile(path.join(root, 'en/index.html'), html);
  const report = await restorePlaceholderAssets({
    root,
    fetchImpl: async () =>
      new Response(new Uint8Array([0, 0, 0, 0]), {
        headers: { 'content-type': 'image/avif' },
      }),
  });
  assert.equal(report.pagesChanged, 2);
  assert.equal(report.placeholderOccurrences, 2);
  assert.equal(report.restoredOriginals, 1);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const local = manifest.assets[`https://static.wixstatic.com/media/${uri}/v1/fit/w_1600,h_900,q_90,enc_avif,quality_auto/${uri}`];
  const result = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.ok(result.includes(`media="(min-width: 320px) and (max-width: 750px)" srcset="/deedee-studio-static${local} 320w"`));
  assert.ok(result.includes('/assets/already-sharp.avif'));
  assert.ok(!result.includes(old));
  const second = await restorePlaceholderAssets({ root, fetchImpl: async () => new Response('unused', { status: 500 }) });
  assert.equal(second.restoredOriginals, 0);
  assert.equal(second.pagesChanged, 0);
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
