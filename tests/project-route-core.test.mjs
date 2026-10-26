import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRouteTargets, resolveManifestAsset, assertLocalAssetsExist, resolveLocalRoute, splitSrcsetCandidates } from '../scripts/project-route-core.mjs';

const route = (pathname, canonicalPathname = pathname) => ({ pathname, canonicalPathname, title: `Title ${pathname}` });

test('route restoration accepts a focused allowlisted route batch', async () => {
  const { mkdtemp, mkdir, readFile, rm, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { restoreProjectRoutes } = await import('../scripts/restore-project-routes.mjs');
  const root = await mkdtemp(path.join(tmpdir(), 'deedee-route-restore-'));

  try {
    await mkdir(path.join(root, 'docs'), { recursive: true });
    await writeFile(path.join(root, 'docs/ROUTE_STATUS.md'), [
      '# Routes',
      '| `/en/freefire` | — | — | Chưa có trang chi tiết local |',
      '',
    ].join('\n'));
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ pages: [], assets: {} }));
    const markup = `<!doctype html><html><head><title>GARENA FREE FIRE</title><link rel="canonical" href="https://www.deedeestudio.net/en/freefire"></head><body><main>${'x'.repeat(50050)}</main></body></html>`;
    const result = await restoreProjectRoutes({
      root,
      routes: ['/en/freefire'],
      fetchImpl: async (url) => ({ status: 200, url, text: async () => markup }),
    });
    const restored = await readFile(path.join(root, 'en/freefire/index.html'), 'utf8');
    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));

    assert.equal(result.routes, 1);
    assert.equal(result.outputs, 1);
    assert.match(restored, /GARENA FREE FIRE/);
    assert.equal(manifest.pages[0].route, '/en/freefire');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('resolves canonical routes and creates aliases without duplicating page targets', () => {
  const result = resolveRouteTargets([
    route('/all-project/an-unexpected-guest', '/en/all-project/an-unexpected-guest'),
    route('/en/all-project/an-unexpected-guest'),
    route('/en/all-project/5-super-heroes'),
  ]);

  assert.equal(result.targets.get('/en/all-project/an-unexpected-guest').kind, 'page');
  assert.equal(result.targets.get('/all-project/an-unexpected-guest').kind, 'redirect');
  assert.equal(result.targets.get('/all-project/an-unexpected-guest').destination, '/en/all-project/an-unexpected-guest');
  assert.equal(result.targets.get('/en/all-project/5-super-heroes').kind, 'page');
});

test('maps a transformed Wix URL to an existing manifest asset by media identity', () => {
  const manifestAssets = {
    'https://static.wixstatic.com/media/abc123.jpg/v1/fill/w_480,h_320/abc123.jpg': '/assets/abc123-local.webp',
  };

  assert.equal(
    resolveManifestAsset('https://static.wixstatic.com/media/abc123.jpg/v1/fit/w_1600/abc123.jpg?foo=1', manifestAssets),
    '/assets/abc123-local.webp',
  );
});

test('rejects a page that references a missing local asset path', async () => {
  await assert.rejects(
    assertLocalAssetsExist('<img src="/assets/missing.webp">', '/tmp/deedee-assets-fixture'),
    /missing\.webp/,
  );
});

test('falls back to an existing local route when a Wix language route was not captured', () => {
  assert.equal(resolveLocalRoute('/en/aboutus', new Set(['/aboutus'])), '/aboutus');
  assert.equal(resolveLocalRoute('/en/all-project/example', new Set(['/en/all-project/example'])), '/en/all-project/example');
});

test('splits Wix srcset candidates without splitting commas inside transformed URLs', () => {
  const srcset = 'https://static.wixstatic.com/media/foo.png/v1/fill/w_44,h_44,al_c,q_85,blur_3,enc_avif,quality_auto/logo.png 44w, https://static.wixstatic.com/media/foo.png/v1/fill/w_88,h_88,al_c,q_85,blur_3,enc_avif,quality_auto/logo.png 88w';
  assert.deepEqual(splitSrcsetCandidates(srcset), [
    {
      url: 'https://static.wixstatic.com/media/foo.png/v1/fill/w_44,h_44,al_c,q_85,blur_3,enc_avif,quality_auto/logo.png',
      descriptor: '44w',
    },
    {
      url: 'https://static.wixstatic.com/media/foo.png/v1/fill/w_88,h_88,al_c,q_85,blur_3,enc_avif,quality_auto/logo.png',
      descriptor: '88w',
    },
  ]);
});

test('splits density candidates and handles empty srcset input', () => {
  const srcset = 'https://static.wixstatic.com/media/one.png/v1/fill/w_44,h_44/a.png 1x, https://static.wixstatic.com/media/two.png/v1/fill/w_88,h_88/b.png 2x';
  assert.deepEqual(splitSrcsetCandidates(srcset).map(({ descriptor }) => descriptor), ['1x', '2x']);
  assert.deepEqual(splitSrcsetCandidates(''), []);
  assert.deepEqual(splitSrcsetCandidates(null), []);
});

test('rewrites transformed Wix srcset candidates to verified local assets', async () => {
  const { rewriteStaticMarkup } = await import('../scripts/restore-project-routes.mjs');
  const srcset = 'https://static.wixstatic.com/media/logo.png/v1/fill/w_44,h_44,al_c,quality_auto/logo.png 44w, https://static.wixstatic.com/media/logo.png/v1/fill/w_88,h_88,al_c,quality_auto/logo.png 88w';
  const output = rewriteStaticMarkup(
    `<img srcset="${srcset}">`,
    '/en/all-project/example',
    { 'https://static.wixstatic.com/media/logo.png': '/assets/logo.webp' },
    new Map(),
    new Set(),
    new Set(['/en/all-project/example']),
  );

  assert.match(output, /srcset="\/deedee-studio-static\/assets\/logo\.webp 44w, \/deedee-studio-static\/assets\/logo\.webp 88w"/);
  assert.doesNotMatch(output, /static\.wixstatic\.com/);
});
