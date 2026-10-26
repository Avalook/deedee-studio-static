import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_FILE = 'en/careers/index.html';
const BASE = '/deedee-studio-static';

// Cards as the live https://www.deedeestudio.net/en/careers listing serves them, in source order.
const SOURCE_CARDS = [
  { title: 'Does Adult Animation Always Look Mature?', slug: 'does-adult-animation-always-look-mature', image: `${BASE}/assets/project-4c1018cfd6dda724f087dede.webp` },
  { title: 'How DeeDee Brought Hand-inked Look into Digital Animation', slug: 'how-deedee-brought-hand-inked-look-into-digital-animation', image: `${BASE}/assets/760e736a615878250bc15853.webp` },
  { title: 'What’s the Key to Seamless International Collaboration?', slug: 'what-s-the-key-to-seamless-international-collaboration', image: `${BASE}/assets/6668f4c65ed32be5edb430b1.webp` },
  { title: 'Why Adult Animation Needs Strong Art Direction', slug: 'why-adult-animation-needs-strong-art-direction', image: `${BASE}/assets/6ab66146d79abb7359751280.webp` },
  { title: 'DeeDee and Hoang Thi The: Fate & Destiny Featured in French-Language News Report', slug: 'deedee-and-hoang-thi-the-fate-destiny-featured-in-french-language-news-report', image: `${BASE}/assets/3876bc6e031fae42564b3874.webp` },
  { title: 'Storyboard: Making the Film Before Making the Film', slug: 'storyboard-making-the-film-before-making-the-film', image: `${BASE}/assets/6e0551f29687d9a5b3911947.webp` },
  { title: 'Why 2D Is the Perfect Match for Adult Animation', slug: 'why-2d-is-the-perfect-match-for-adult-animation', image: `${BASE}/assets/182589cfaf279bad57b52f84.webp` },
  { title: 'When DeeDee Is Featured in English-Language Media', slug: 'when-deedee-is-featured-in-english-language-media', image: `${BASE}/assets/88de9312eaef8fda5ee0648d.webp` },
  { title: 'Why I Approved Some Off-Model Scenes: Perspective from DeeDee’s Animation Supervisor', slug: 'why-i-approved-some-off-model-scenes-perspective-from-deedee-s-animation-supervisor', image: `${BASE}/assets/100569c1738dfe4169ddb023.webp` },
  { title: 'Broken Being: Building a Post-Apocalyptic Universe Inspired by Vietnamese Mythology', slug: 'broken-being-building-a-post-apocalyptic-universe-inspired-by-vietnamese-mythology', image: `${BASE}/assets/922b0fd2593aac1bcd67a7d8.webp` },
];

const ITEM_CONTAINERS = /<div[^>]*data-hook="item-container"[^>]*>/g;

// Wix writes card titles with &nbsp; between some words, so titles are compared after decoding.
const decodeEntities = value => value
  .replaceAll('&nbsp;', ' ')
  .replaceAll('&#39;', "'")
  .replaceAll('&quot;', '"')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&');

const cardTitles = html => [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map(match => decodeEntities(match[1]));

async function loadPage() {
  return readFile(path.join(ROOT, PAGE_FILE), 'utf8');
}

test('/en/careers is registered as its own route, not an alias of /en/carrers', async () => {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
  const entry = manifest.pages.find(page => page.route === '/en/careers');
  assert.ok(entry, 'manifest lists /en/careers');
  assert.equal(entry.file, PAGE_FILE);
  assert.ok(existsSync(path.join(ROOT, entry.file)), 'the registered file exists');
  assert.ok(manifest.pages.some(page => page.route === '/en/carrers'), '/en/carrers stays a separate route');

  const docs = await readFile(path.join(ROOT, 'docs/ROUTE_STATUS.md'), 'utf8');
  const row = docs.split('\n').find(line => line.startsWith('| `/en/careers` '));
  assert.ok(row, 'ROUTE_STATUS documents /en/careers');
  assert.ok(row.includes('`en/careers/index.html`'), 'the status row points at the page file');
});

test('/en/careers keeps the source page identity', async () => {
  const html = await loadPage();
  assert.match(html, /^<!doctype html><html lang="en"/i);
  assert.ok(html.includes('<title>Tuyển dụng2 | DeeDee Animation Studio</title>'), 'source title is kept');
  assert.ok(html.includes(`<link rel="canonical" href="${BASE}/en/careers">`), 'canonical is localized to the route');
  assert.ok(html.includes(`<meta property="og:url" content="${BASE}/en/careers"`), 'og:url matches the canonical');
  assert.ok(!html.includes('READY TO BE A PART OF DEEDEE TEAM'), 'the page is not the /en/carrers career landing');
});

test('/en/careers renders all ten source cards with their own post links and thumbnails', async () => {
  const html = await loadPage();
  assert.equal((html.match(ITEM_CONTAINERS) ?? []).length, SOURCE_CARDS.length, 'the listing has exactly the ten source cards');
  const titles = cardTitles(html);
  for (const card of SOURCE_CARDS) {
    assert.ok(titles.includes(card.title), `${card.title} keeps the source title`);
    assert.ok(html.includes(`href="${BASE}/en/post/${card.slug}/"`), `${card.title} links to its English post route`);
    assert.ok(html.includes(`src="${card.image}"`), `${card.title} uses a locally archived thumbnail`);
  }
});

test('/en/careers keeps the source header behaviour and internalizes every link', async () => {
  const html = await loadPage();
  assert.equal((html.match(/href="\/deedee-studio-static\/en\/carrers\/"/g) ?? []).length, 2, 'header Career points at the directory route on Pages');
  assert.ok(!/href="https?:\/\/www\.deedeestudio\.net/.test(html), 'no site link points back to the Wix origin');
});

test('/en/careers uses Wix card columns and spacing at desktop, tablet, and phone sizes', async () => {
  const html = await loadPage();
  const css = await readFile(path.join(ROOT, 'assets', 'project-gallery-parity.css'), 'utf8');

  assert.match(html, /data-deedee-careers-gallery/);
  assert.match(html, /project-gallery-parity\.css/);
  assert.match(css, /data-deedee-careers-gallery/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,/);
  assert.match(css, /grid-template-columns:\s*repeat\(3,/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /gap:\s*32px/);
  assert.match(css, /height:\s*calc\(350px \+ \(15vw - 19\.2px\)\)/);
  assert.match(css, /height:\s*calc\(350px \+ 25vw - 16px\)/);
  assert.match(css, /height:\s*calc\(350px \+ 75vw\)/);
});

test('/en/careers fetches nothing from Wix at runtime', async () => {
  const html = await loadPage();
  assert.equal((html.match(/\ssrcset=|\simagesrcset=|\ssrcSet=/g) ?? []).length, 0, 'responsive srcset hints are dropped like the other archived pages');
  assert.equal((html.match(/<script(?![^>]*data-deedee-)/g) ?? []).length, 0, 'only the local runtime modules are loaded');
  assert.equal((html.match(/<link[^>]*\brel="(?:preload|prefetch)"/g) ?? []).length, 0, 'no Wix bundle hints survive');
  assert.equal((html.match(/static\.wixstatic\.com\/ufonts|parastorage\.com\/fonts/g) ?? []).length, 0, 'font faces resolve to archived files');
  const assetRefs = [...new Set(html.match(/\/deedee-studio-static\/assets\/[^"')\s]+/g) ?? [])];
  assert.ok(assetRefs.length > 40, 'the page references its archived assets');
  for (const reference of assetRefs) {
    assert.ok(existsSync(path.join(ROOT, reference.slice(BASE.length))), `${reference} exists on disk`);
  }
});

test('/en/careers reveals the gallery with the geometry Wix authored for it', async () => {
  const html = await loadPage();
  const containers = html.match(ITEM_CONTAINERS) ?? [];
  assert.equal(containers.length, SOURCE_CARDS.length);
  for (const container of containers) {
    const style = container.match(/\sstyle="([^"]*)"/)?.[1] ?? '';
    assert.match(style, /width:\s*30[56]px/, 'items keep the source 305px column width');
    assert.match(style, /height:\s*578\.75px/, 'items keep the source row height');
    assert.ok(style.includes('opacity:1') && style.includes('display:block'), 'items are stored in the revealed state the Vietnamese sibling uses');
    assert.ok(!style.includes('display:none'), 'no item stays hidden behind the Wix runtime');
  }
});


test('/en/carrers restores the source responsive activity galleries', async () => {
  const html = await readFile(path.join(ROOT, 'en/carrers/index.html'), 'utf8');
  assert.ok(html.includes('en-carrers-responsive-parity.css'), 'the English career route loads a scoped gallery override');

  const css = await readFile(path.join(ROOT, 'assets/en-carrers-responsive-parity.css'), 'utf8');
  assert.ok(css.includes('@media screen and (max-width: 600px)'));
  assert.ok(css.includes('#pro-gallery-margin-container-comp-m8hitxkn'));
  assert.ok(css.includes('grid-template-columns: minmax(0, 1fr)'));
  assert.ok(css.includes('grid-auto-rows: calc(56.25vw + 72px)'));
  assert.ok(css.includes('row-gap: 20px'));
  assert.ok(css.includes('@media screen and (min-width: 601px) and (max-width: 1359px)'));
  assert.ok(css.includes('#pro-gallery-margin-container-comp-m8ha3620'));
  assert.ok(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'));
  assert.ok(css.includes('aspect-ratio: 16 / 9'));
});


test('/en/carrers hides the first activity gallery on the 601–750px layout', async () => {
  const css = await readFile(path.join(ROOT, 'assets/en-carrers-responsive-parity.css'), 'utf8');
  const mobileTablet = css.match(/@media screen and \(min-width: 601px\) and \(max-width: 750px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const wideTablet = css.match(/@media screen and \(min-width: 751px\) and \(max-width: 1359px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const broadTablet = css.match(/@media screen and \(min-width: 601px\) and \(max-width: 1359px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(mobileTablet, /#comp-m727lon0,[\s\S]*?display: none !important/);
  assert.match(mobileTablet, /#comp-m7t6d1e6[\s\S]*?display: flex !important/);
  assert.doesNotMatch(broadTablet, /#comp-m727lon0[\s\S]*?display: flex !important/);
  assert.match(wideTablet, /#comp-m727lon0,[\s\S]*?display: flex !important/);
});


test('/en/carrers enables exactly the source galleries at tablet breakpoints', async () => {
  const css = await readFile(path.join(ROOT, 'assets/en-carrers-responsive-parity.css'), 'utf8');
  const narrowTablet = css.match(/@media screen and \(min-width: 601px\) and \(max-width: 750px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const widerTablet = css.match(/@media screen and \(min-width: 751px\) and \(max-width: 1359px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(narrowTablet, /#comp-m727lon0,\s*#comp-m8ha3620\s*\{\s*display: none !important;/);
  assert.match(narrowTablet, /#comp-m8hitxkn\s*\{\s*display: block !important;/);
  assert.match(widerTablet, /#comp-m8ha3620,\s*#comp-m8hitxkn\s*\{\s*display: block !important;/);
});
