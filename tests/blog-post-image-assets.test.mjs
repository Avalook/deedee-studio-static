import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ROUTE_FILE = path.join(ROOT, 'en/post/does-adult-animation-always-look-mature/index.html');
const BASE = '/deedee-studio-static/';

function readAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
}

test('English adult-animation article restores the related thumbnail and footer social icons locally', async () => {
  const html = await readFile(ROUTE_FILE, 'utf8');
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  const expected = new Map([
    ['What’s the Key to Seamless International Collaboration?', ['/assets/863607ee49ed40a0944472fb.jpg']],
    ['Group 625973', ['/assets/project-detail-74eaa6b70b32fa5178725aca.webp', '/assets/project-detail-74eaa6b70b32fa5178725aca.webp']],
    ['Group 625970', ['/assets/project-detail-a0e03606a4c45eaabb5789f8.webp', '/assets/project-detail-a0e03606a4c45eaabb5789f8.webp']],
    ['Layer_1', ['/assets/project-detail-e1840d6a03078d299acd8141.webp', '/assets/project-detail-e1840d6a03078d299acd8141.webp']],
    ['Layer_1-1', ['/assets/project-detail-014fd36a43bf116b12f13fcf.webp', '/assets/project-detail-014fd36a43bf116b12f13fcf.webp']],
    ['X       ', ['/assets/project-detail-63245ed5ccefc3578b46df9e.webp', '/assets/project-detail-63245ed5ccefc3578b46df9e.webp']],
    ['Layer_1-2', ['/assets/project-detail-5a3c184285e6718983c4bf79.webp', '/assets/project-detail-5a3c184285e6718983c4bf79.webp']],
    ['Layer_1-4', ['/assets/project-detail-30af5642d69f2345633e30c7.webp', '/assets/project-detail-30af5642d69f2345633e30c7.webp']],
  ]);

  for (const [alt, expectedPaths] of expected) {
    const matching = images.filter((tag) => readAttribute(tag, 'alt') === alt);
    assert.equal(matching.length, expectedPaths.length, `keeps all captured images for ${alt}`);
    assert.deepEqual(matching.map((tag) => readAttribute(tag, 'src')), expectedPaths.map((asset) => `${BASE}${asset.slice(1)}`), `${alt} uses the verified local asset`);
    const expectedFit = alt.startsWith('What’s') ? 'cover' : 'contain';
    assert.ok(matching.every((tag) => readAttribute(tag, 'style') === `width:100%;height:100%;object-fit:${expectedFit}`), `${alt} is sized to its Wix image frame`);
    for (const asset of expectedPaths) {
      await access(path.join(ROOT, asset.slice(1)));
    }
  }
});

test('Vietnamese international-collaboration article restores Wix layout and full-page geometry locally', async () => {
  const routeHtml = await readFile(
    path.join(ROOT, 'post/chia-khoa-cho-mot-quy-trinh-hop-tac-quoc-te/index.html'),
    'utf8',
  );
  const css = await readFile(
    path.join(ROOT, 'assets/international-collaboration-post-mobile-parity.css'),
    'utf8',
  );

  assert.match(
    routeHtml,
    /href="\/deedee-studio-static\/assets\/international-collaboration-post-mobile-parity\.css"/,
    'loads the parity rules only on this article route',
  );
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
  assert.match(css, /@media\s*\(min-width:\s*340px\)\s*and\s*\(max-width:\s*413px\)/);
  assert.match(css, /@media\s*\(min-width:\s*414px\)\s*and\s*\(max-width:\s*600px\)/);
  assert.match(css, /\.L5x0Fp[^}]*width:\s*calc\(100% \+ 32px\)[^}]*margin-left:\s*4px/s);
  assert.match(css, /\.L5x0Fp[^}]*padding-left:\s*0[^}]*padding-right:\s*0/s);
  assert.match(css, /h1\.H3vOVf[^}]*font-size:\s*26px/s);
  assert.match(css, /\.tgMH9T\s+p[^}]*font-size:\s*16px/s);
  assert.match(css, /\.tgMH9T\s+h2[^}]*font-size:\s*24px/s);
  assert.doesNotMatch(css, /section\.prZ8Wc\s*\{\s*display:\s*none\s*!important;/s);
  assert.match(css, /@media\s*\(min-width:\s*601px\)\s*and\s*\(max-width:\s*746px\)/);
  assert.match(css, /recent-post-list-item[^}]*display:\s*none\s*!important/s);
  assert.match(css, /recent-post-list-item[^}]*width:\s*100%\s*!important/s);
  assert.match(
    css,
    /@media\s*\(min-width:\s*1001px\)\s*and\s*\(max-width:\s*1024px\)[\s\S]*article(?:\.tgMH9T)?\[data-hook="post"\]\s+footer\[data-hook="post-footer"\][^{]*\{[^}]*height:\s*108px\s*!important/s,
    'matches the verified shorter post action row at the 1024px breakpoint',
  );
  assert.match(
    css,
    /@media\s*\(min-width:\s*1440px\)[\s\S]*#comp-m8cfkxz1\s*>\s*section\[data-block-level-container="Section"\][^{]*\{[^}]*padding-bottom:\s*8px\s*!important/s,
    'restores the eight-pixel footer tail at 1440px without changing 1024px',
  );
});
