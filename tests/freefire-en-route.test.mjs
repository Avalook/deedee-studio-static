import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE_FILE = 'en/freefire/index.html';
const BASE = '/deedee-studio-static';

// Body copy exactly as the live https://www.deedeestudio.net/en/freefire page serves it, in source order.
const SOURCE_PARAGRAPHS = [
  "'Free Fire' is an animation commercial video that DeeDee Animation Studio produced for Garena Vietnam in 2019, for the promotion of the mobile game Free Fire.",
  'Designed with a lovable and goofy animation style, the characters walk the audiences (new players) through the basic instructions of the mobile game Garena Free Fire.',
  'The video accumulated over 3 million views on YouTube only after one week upon its release.',
];

// Sentences that only exist on the Vietnamese sibling; they must not sit under the English URL.
const VI_ONLY_COPY = [
  'Được thiết kế với phong cách hoạt hình đáng yêu và ngộ nghĩnh',
  'Chỉ sau một tuần được trình chiếu, video đã đạt được hơn 3 triệu tổng lượt xem',
];

// Selectors the Wix runtime renders: the header one and the pinned-layer one.
const SELECTOR_IDS = ['comp-l9quglcu_r_comp-m73k8b651', 'comp-la0k3h19_r_comp-la0lay65'];

// Remote sources the archived Vietnamese sibling keeps as well: outbound copy links, the Wix
// tracking noscript, the YouTube embed and the social preview image. The last entry is a
// data-url provenance pointer whose CSS build has no archived copy; nothing fetches it.
const ALLOWED_REMOTE_PREFIXES = [
  'https://youtu.be/YT0BG5Q647E',
  'https://ff.garena.vn/',
  'https://www.googletagmanager.com/ns.html',
  'https://www.youtube.com/embed/YT0BG5Q647E',
  'https://static.wixstatic.com/media/5b44bf_82ea9edc412f4754af06093f3e47bb55~mv2.jpg',
  'https://static.parastorage.com/services/wix-thunderbolt/dist/main.d189c0b1.min.css',
];

const decodeEntities = value => value
  .replaceAll('&nbsp;', ' ')
  .replaceAll('&#39;', "'")
  .replaceAll('&quot;', '"')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&');

const plainText = markup => decodeEntities(markup.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

const paragraphTexts = html => [...html.matchAll(/<p class="font_8[^"]*">([\s\S]*?)<\/p>/g)].map(match => plainText(match[1]));

const remoteRefs = html => [...new Set([
  ...[...html.matchAll(/(?:src|href|poster|data-url|data-href|content)="((?:https?:)\/\/[^"]+)"/g)].map(match => match[1]),
  ...[...html.matchAll(/url\((["']?)((?:https?:)\/\/[^)"']+)\1\)/g)].map(match => match[2]),
])];

async function loadPage() {
  return readFile(path.join(ROOT, PAGE_FILE), 'utf8');
}

test('/en/freefire is its own route, not a redirect onto /freefire', async () => {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
  const entry = manifest.pages.find(page => page.route === '/en/freefire');
  assert.ok(entry, 'manifest lists /en/freefire');
  assert.equal(entry.file, PAGE_FILE);
  assert.ok(existsSync(path.join(ROOT, entry.file)), 'the registered file exists');
  assert.ok(manifest.pages.some(page => page.route === '/freefire'), '/freefire stays a separate route');

  const docs = await readFile(path.join(ROOT, 'docs/ROUTE_STATUS.md'), 'utf8');
  const row = docs.split('\n').find(line => line.startsWith('| `/en/freefire` '));
  assert.ok(row, 'ROUTE_STATUS documents /en/freefire');
  assert.ok(row.includes('`en/freefire/index.html`'), 'the status row points at the page file');

  const html = await loadPage();
  assert.ok(!/http-equiv="refresh"/i.test(html), 'the page never redirects');
  assert.ok(html.includes(`<link rel="canonical" href="${BASE}/en/freefire">`), 'canonical stays on the English route');
});

test('/en/freefire serves the English source copy', async () => {
  const html = await loadPage();
  assert.match(html, /<html lang="en"/i);
  assert.ok(html.includes('<title>GARENA FREE FIRE | DeeDee Studio</title>'), 'source title is kept');
  assert.ok(html.includes('<meta property="og:title" content="GARENA FREE FIRE | DeeDee Studio">'), 'social title matches the source');
  assert.ok(html.includes('<h1 class="font_0 wixui-rich-text__text" style="text-align:center;">FREE FIRE</h1>'), 'heading is FREE FIRE');
  assert.deepEqual(paragraphTexts(html), SOURCE_PARAGRAPHS, 'the three English paragraphs are served verbatim');
  for (const vietnamese of VI_ONLY_COPY) {
    assert.ok(!html.includes(vietnamese), `${vietnamese} belongs to the Vietnamese route only`);
  }
});

test('/en/freefire keeps the source alternate metadata', async () => {
  const html = await loadPage();
  assert.ok(html.includes(`href="${BASE}/freefire" hreflang="x-default"`), 'x-default points at the Vietnamese page');
  assert.ok(html.includes(`href="${BASE}/en/freefire" hreflang="en-us"`), 'en-us points at this page');
  assert.ok(html.includes(`href="${BASE}/freefire" hreflang="en"`), 'the source hreflang="en" quirk is reproduced, not corrected');
  assert.ok(!/href="https?:\/\/www\.deedeestudio\.net/.test(html), 'no metadata points back to the Wix origin');
});

test('/en/freefire keeps the Garena video and its client', async () => {
  const html = await loadPage();
  const iframes = html.match(/<iframe\b[^>]*youtube\.com\/embed\/[^>]*>/g) ?? [];
  assert.equal(iframes.length, 1, 'exactly one YouTube embed is present');
  assert.ok(iframes[0].includes('src="https://www.youtube.com/embed/YT0BG5Q647E?'), 'the source video YT0BG5Q647E is embedded');
  assert.ok(iframes[0].includes('forigin=https%3A%2F%2Fwww.deedeestudio.net%2Fen%2Ffreefire'), 'the embed is the one the English page renders');
  assert.ok(iframes[0].includes('title="FREE FIRE LÀ GÌ?"'), 'the embed keeps the source video title');
  assert.ok(html.includes('data-player-name="YouTube"'), 'the Wix player container is stored in its revealed state');
  assert.ok(html.includes('class="VideoPlayer2054936319__root comp-l9paxth0 wixui-video-player"'), 'the player root keeps its source markup');
  assert.ok(html.includes('href="https://ff.garena.vn/"'), 'the Garena client link from the source copy is kept');
  const logo = html.match(/<img[^>]*alt="6\.png"[^>]*>/)?.[0] ?? '';
  const logoSrc = logo.match(/src="([^"]+)"/)?.[1] ?? '';
  assert.ok(logoSrc.startsWith(`${BASE}/assets/`), 'the client logo is an archived asset');
  assert.ok(existsSync(path.join(ROOT, logoSrc.slice(BASE.length))), 'the client logo exists on disk');
});

test('/en/freefire offers English as the current language and routes VI to /freefire', async () => {
  const html = await loadPage();
  for (const componentId of SELECTOR_IDS) {
    const container = html.match(new RegExp(`<div id="${componentId}"[^>]*data-testid="language-selector-container"`));
    assert.ok(container, `${componentId} renders the language selector instead of an empty placeholder`);
  }
  assert.equal((html.match(/aria-label="Language Selector: English"/g) ?? []).length, SELECTOR_IDS.length, 'both handles report English as current');
  assert.equal((html.match(/aria-label="Language Selector: Vietnamese"/g) ?? []).length, 0, 'the Vietnamese handle belongs to the Vietnamese page');
  assert.equal((html.match(/data-testid="dropdown-option-vi"/g) ?? []).length, 3, 'every selector offers the Vietnamese option');
  assert.ok(html.includes('class="SVOqp3 wixui-language-menu__option tJr0E9 nOw6jW" data-testid="dropdown-option-en"'), 'English is marked as the selected option');

  const runtime = html.match(/<script data-deedee-local-runtime>([\s\S]*?)<\/script>/);
  assert.ok(runtime, 'the shared local runtime is injected like the sibling pages');
  assert.ok(runtime[1].includes('"/deedee-studio-static/en/freefire":"/deedee-studio-static/freefire"'), 'EN -> VI route pair');
  assert.ok(runtime[1].includes('"/deedee-studio-static/freefire":"/deedee-studio-static/en/freefire"'), 'VI -> EN route pair');
  assert.ok(html.includes('<script type="module" data-deedee-site-controls src="/deedee-studio-static/scripts/site-controls.mjs">'), 'site controls are loaded');
});

test('Vietnamese Free Fire Hack restores the verified Wix video player', async () => {
  const playerSource = await readFile(path.join(ROOT, 'scripts/project-video-player.mjs'), 'utf8');
  assert.match(playerSource, /route:\s*'\/freefirehack'[\s\S]*?containerId:\s*'comp-l9pb1lco4'[\s\S]*?youtube\.com\/embed\/I8aDHqsLAGE/);
  const html = await readFile(path.join(ROOT, 'freefirehack/index.html'), 'utf8');
  assert.ok(html.includes('data-deedee-project-video-player'), 'the verified video player module is loaded');
});

test('Vietnamese Free Fire Hack route preserves the localized Wix page', async () => {
  const html = await readFile(path.join(ROOT, 'freefirehack/index.html'), 'utf8');
  assert.match(html, /NÊN LÀM GÌ KHI GẶP HACK\?/);
  assert.ok(html.includes('Cách đây 1 năm, nhà DeeDee có làm một chiếc clip'));
  assert.match(html, /<html lang="vi"/);
  assert.ok(html.includes('hreflang="en-us"'), 'Vietnamese route declares its English counterpart');
  assert.ok(html.includes('/deedee-studio-static/assets/'));
  assert.ok(html.includes('/deedee-studio-static/assets/freefire-gallery-parity.css'));
  const galleryCss = await readFile(path.join(ROOT, 'assets/freefire-gallery-parity.css'), 'utf8');
  assert.match(galleryCss, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(galleryCss, /#comp-l9pb4sld \[data-hook="item-container"\][\s\S]*?opacity:\s*1 !important/);
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
  assert.ok(manifest.pages.some((page) => page.route === '/freefirehack' && page.file === 'freefirehack/index.html'));
});

test('/home-again follows the Wix canonical redirect to /en/home-again', async () => {
  const html = await readFile(path.join(ROOT, 'home-again/index.html'), 'utf8');
  assert.match(html, /http-equiv="refresh" content="0;url=\/deedee-studio-static\/en\/home-again\/?"/);
  assert.match(html, /location\.replace\(['"]\/deedee-studio-static\/en\/home-again\//);
});

test('Vietnamese Free Fire routes its English selector to /en/freefire', async () => {
  const html = await readFile(path.join(ROOT, 'freefire/index.html'), 'utf8');
  const runtimeStart = html.indexOf('<script data-deedee-local-runtime>');
  const runtimeEnd = html.indexOf('</script>', runtimeStart);
  const runtime = runtimeStart < 0 || runtimeEnd < 0 ? null : html.slice(runtimeStart, runtimeEnd);
  assert.ok(runtime, 'the Vietnamese page uses the shared local runtime');
  assert.ok(runtime.includes('"/deedee-studio-static/freefire":"/deedee-studio-static/en/freefire"'), 'VI -> EN route pair stays on the Free Fire page');
  assert.ok(html.includes('data-testid="dropdown-option-en"'), 'the Vietnamese selector offers English');
  assert.ok(html.includes('data-deedee-site-controls'), 'the local selector click handler is loaded');

});

test('English Free Fire Hack restores the verified Wix video player', async () => {
  const playerSource = await readFile(path.join(ROOT, 'scripts/project-video-player.mjs'), 'utf8');
  assert.ok(playerSource.includes("route: '/en/freefirehack',"), 'the EN route is mapped to the verified player');
  assert.ok(playerSource.includes("containerId: 'comp-l9pb1lco4',"), 'the Wix player container is mapped');
  assert.ok(playerSource.includes("src: 'https://www.youtube.com/embed/I8aDHqsLAGE',"), 'the verified source video is used');
  const html = await readFile(path.join(ROOT, 'en/freefirehack/index.html'), 'utf8');
  assert.ok(html.includes('data-deedee-project-video-player'), 'the verified video player module is loaded');
});

test('English Free Fire Hack restores the responsive Wix project gallery', async () => {
  const html = await readFile(path.join(ROOT, 'en/freefirehack/index.html'), 'utf8');
  assert.ok(html.includes('href="/deedee-studio-static/assets/freefire-gallery-parity.css"'), 'the gallery parity stylesheet is loaded');
  const galleryCss = await readFile(path.join(ROOT, 'assets/freefire-gallery-parity.css'), 'utf8');
  assert.match(galleryCss, /#comp-l9pb4sld #pro-gallery-margin-container-comp-l9pb4sld[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(galleryCss, /\[data-hook="item-link-wrapper"\]\[data-idx="2"\][\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*2/);
  assert.match(galleryCss, /\[data-hook="item-link-wrapper"\]\[data-idx="3"\][\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*2/);
  assert.match(galleryCss, /\[data-hook="item-link-wrapper"\]\[data-idx="4"\][\s\S]*?grid-column:\s*2[\s\S]*?grid-row:\s*3/);
  assert.match(galleryCss, /\[data-hook="item-link-wrapper"\]\[data-idx="5"\][\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*3/);
  assert.match(galleryCss, /#comp-l9pb4sld \[data-hook="item-container"\][\s\S]*?display:\s*block !important/);
  assert.match(galleryCss, /#comp-l9pb4sld \[data-hook="item-container"\][\s\S]*?opacity:\s*1 !important/);
});

test('/en/freefire loads nothing from Wix at runtime', async () => {
  const html = await loadPage();
  assert.equal((html.match(/\ssrcset=|\simagesrcset=/g) ?? []).length, 0, 'the capture split Wix transform srcsets on commas; the archived convention drops them');
  assert.ok((html.match(/<source\b/g) ?? []).length > 0, 'the <picture> sources themselves are kept');
  assert.equal((html.match(/<link[^>]*\brel="(?:preload|prefetch)"/g) ?? []).length, 0, 'no Wix bundle hints survive');
  assert.equal((html.match(/sourceMappingURL/g) ?? []).length, 0, 'no sourcemap comments point at Wix builds');
  assert.equal((html.match(/static\.wixstatic\.com\/ufonts|parastorage\.com\/fonts/g) ?? []).length, 0, 'font faces resolve to archived files');
  assert.equal((html.match(/url\((["']?)https?:\/\/|url\((["']?)\/\//g) ?? []).length, 0, 'no stylesheet url() is remote');
  assert.equal((html.match(/<script(?![^>]*data-deedee-)/g) ?? []).length, 0, 'only the local runtime modules are loaded');

  const assetRefs = [...new Set(html.match(/\/deedee-studio-static\/assets\/[^"')\s]+/g) ?? [])];
  assert.ok(assetRefs.length > 100, 'the page references its archived assets');
  for (const reference of assetRefs) {
    assert.ok(existsSync(path.join(ROOT, reference.slice(BASE.length))), `${reference} exists on disk`);
  }

  for (const reference of remoteRefs(html)) {
    assert.ok(ALLOWED_REMOTE_PREFIXES.some(prefix => reference.startsWith(prefix)), `unexpected remote reference: ${reference}`);
  }
});
