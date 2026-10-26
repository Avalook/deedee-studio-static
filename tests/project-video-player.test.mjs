import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  VERIFIED_PLAYERS,
  createEmbedFrame,
  installProjectVideoPlayer,
  normalizePageRoute,
} from '../scripts/project-video-player.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pageFile = path.join(root, 'all-project', 'let-victory-make-history', 'index.html');

/* Evidence captured from the live Wix route /all-project/let-victory-make-history:
   an iframe https://www.youtube.com/embed/IZis5cqW0dM measuring 565.9x377.2 on desktop. */
const VERIFIED_ROUTE = '/all-project/let-victory-make-history';
const VERIFIED_CONTAINER = 'comp-mtcnqx5k';
const VERIFIED_SRC = 'https://www.youtube.com/embed/IZis5cqW0dM';
const VERIFIED_TITLE = 'LET VICTORY MAKE HISTORY - @RhymasticOfficial ft. GDucky | Bài hát chủ đề AIC 2020';
const WIX_ASPECT_RATIO = 565.9 / 377.2;

class TestElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.id = '';
    this.attributes = new Map();
    this.style = {};
    this.children = [];
    this.parentNode = null;
  }

  setAttribute(name, value) {
    if (name === 'id') this.id = String(value);
    else this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    return this.attributes.get(name) ?? null;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  getElementById(id) {
    return [this, ...this.descendants()].find((node) => node.id === id) ?? null;
  }

  querySelector(tag) {
    return [this, ...this.descendants()].find((node) => node.tagName === tag.toUpperCase()) ?? null;
  }
}

function createDocument(containerId) {
  const body = new TestElement('body');
  if (containerId) {
    const player = new TestElement('div');
    player.id = containerId;
    body.append(player);
  }
  return {
    body,
    createElement: (tag) => new TestElement(tag),
    getElementById: (id) => body.getElementById(id),
  };
}

test('the player source map contains only video sources verified in the live Wix DOM', () => {
  // Every entry comes from the live Wix DOM (tools: crawl of all 168 project pages, 2026-10-26): one embed per
  // route, in the page's video component, on an allowlisted host with a strict embed path.
  assert.ok(VERIFIED_PLAYERS.length >= 3);
  assert.equal(new Set(VERIFIED_PLAYERS.map(({ route }) => route)).size, VERIFIED_PLAYERS.length, 'one player per route');
  for (const entry of VERIFIED_PLAYERS) {
    assert.ok(/^https:\/\/www\.youtube\.com\/embed\/[\w-]+$/.test(entry.src) || /^https:\/\/player\.vimeo\.com\/video\/\d+$/.test(entry.src), entry.route);
    assert.match(entry.containerId, /^comp-[a-z0-9]+$/, entry.route);
    assert.ok(entry.title.length > 0 || /vimeo/.test(entry.src), entry.route);
  }
  assert.ok(VERIFIED_PLAYERS.some(({ src }) => src.startsWith('https://player.vimeo.com/video/')), 'Vimeo embeds are supported');
  const player = VERIFIED_PLAYERS.find(({ route }) => route === VERIFIED_ROUTE);
  assert.deepEqual(player, {
    route: VERIFIED_ROUTE,
    containerId: VERIFIED_CONTAINER,
    src: VERIFIED_SRC,
    title: VERIFIED_TITLE,
  });
  assert.deepEqual(VERIFIED_PLAYERS.find(({ route }) => route === '/freefirehack'), {
    route: '/freefirehack',
    containerId: 'comp-l9pb1lco4',
    src: 'https://www.youtube.com/embed/I8aDHqsLAGE',
    title: 'NÊN LÀM GÌ KHI GẶP HACK? | GARENA FREE FIRE',
  });
  assert.deepEqual(VERIFIED_PLAYERS.find(({ route }) => route === '/en/freefirehack'), {
    route: '/en/freefirehack',
    containerId: 'comp-l9pb1lco4',
    src: 'https://www.youtube.com/embed/I8aDHqsLAGE',
    title: 'NÊN LÀM GÌ KHI GẶP HACK? | GARENA FREE FIRE',
  });
});

test('let-victory page loads the player module and keeps the Wix aspect ratio', () => {
  const html = fs.readFileSync(pageFile, 'utf8');
  assert.match(
    html,
    /<script type="module" data-deedee-project-video-player src="\/deedee-studio-static\/scripts\/project-video-player\.mjs">/,
    'the page must load scripts/project-video-player.mjs as a module',
  );
  const aspectRule = /#comp-mtcnqx5k\{[^}]*--aspect-ratio:([\d.]+)/.exec(html);
  assert.ok(aspectRule, 'the mirrored Wix rule for the player component is required');
  assert.ok(Math.abs(1 / Number(aspectRule[1]) - WIX_ASPECT_RATIO) < 0.01, 'CSS ratio must match the 565.9x377.2 Wix measurement');
});

test('normalizes Pages-prefixed and trailing-slash routes', () => {
  assert.equal(normalizePageRoute('/deedee-studio-static/all-project/let-victory-make-history/'), VERIFIED_ROUTE);
  assert.equal(normalizePageRoute(VERIFIED_ROUTE), VERIFIED_ROUTE);
  assert.equal(normalizePageRoute('/'), '/');
  assert.equal(normalizePageRoute(undefined), '/');
  assert.equal(normalizePageRoute('/all-project/%zz'), '/all-project/%zz');
});

test('hydrating the verified route replaces the empty div with a titled, non-autoplaying iframe', () => {
  const doc = createDocument(VERIFIED_CONTAINER);
  installProjectVideoPlayer(doc, `/deedee-studio-static${VERIFIED_ROUTE}`);

  const iframe = doc.body.querySelector('iframe');
  assert.ok(iframe, 'the verified route must render a player iframe');
  assert.equal(iframe.getAttribute('src'), VERIFIED_SRC, 'no autoplay parameter may be appended');
  assert.doesNotMatch(iframe.getAttribute('src'), /autoplay/i);
  assert.equal(iframe.getAttribute('title'), VERIFIED_TITLE);
  assert.doesNotMatch(iframe.getAttribute('allow'), /autoplay/i);
  assert.match(iframe.getAttribute('allow'), /fullscreen/);
  assert.equal(iframe.getAttribute('referrerpolicy'), 'strict-origin-when-cross-origin');
  assert.equal(iframe.getAttribute('width'), '100%');
  assert.equal(iframe.getAttribute('height'), '100%');

  const frameStyle = Object.entries(iframe.style).map(([name, value]) => `${name}:${value}`).join(';');
  assert.equal(iframe.style.position, 'absolute');
  assert.equal(iframe.style.width, '100%');
  assert.equal(iframe.style.height, '100%');
  assert.match(frameStyle, /inset/, 'the iframe fills the Wix box so its 3:2 ratio is preserved');

  const container = doc.body.getElementById(VERIFIED_CONTAINER);
  assert.equal(container.children.length, 1, 'the placeholder div holds exactly one frame');
});

test('the player inherits the Wix breakpoint that hides the video section on phones', () => {
  const html = fs.readFileSync(pageFile, 'utf8');
  assert.match(
    html,
    /@media screen and \(min-width: 320px\) and \(max-width: 750px\)\{#comp-m73kgl0u\{--l_display:none;\}\}/,
    'the section hide rule verified on live Wix must stay untouched',
  );

  const doc = createDocument(VERIFIED_CONTAINER);
  installProjectVideoPlayer(doc, VERIFIED_ROUTE);
  const container = doc.body.getElementById(VERIFIED_CONTAINER);
  assert.deepEqual(Object.keys(container.style), ['position'], 'hydration must not override the responsive display of the Wix box');
});

test('unverified routes and pages without the component stay untouched', () => {
  for (const pathname of ['/', '/en/all-project/let-victory-make-history', '/all-project/sunny-side-down']) {
    const doc = createDocument(VERIFIED_CONTAINER);
    installProjectVideoPlayer(doc, pathname);
    assert.equal(doc.body.querySelector('iframe'), null, `${pathname} has no verified player evidence`);
    assert.equal(doc.body.getElementById(VERIFIED_CONTAINER).children.length, 0);
  }

  const doc = createDocument(null);
  installProjectVideoPlayer(doc, VERIFIED_ROUTE);
  assert.equal(doc.body.querySelector('iframe'), null, 'a missing component must not be invented');
});

test('the frame factory rejects sources outside the verified allowlist', () => {  const doc = createDocument(null);
  for (const src of ['javascript:alert(1)', 'not a url', 'http://www.youtube.com/embed/IZis5cqW0dM', 'https://evil.example/embed/IZis5cqW0dM', 'https://www.youtube.com/watch?v=IZis5cqW0dM']) {
    assert.equal(createEmbedFrame(doc, { src, title: 'x' }), null);
  }
});

test('Vimeo embeds are accepted only in the player.vimeo.com/video/<id> form', () => {
  const doc = { createElement: tag => new TestElement(tag) };
  const frame = createEmbedFrame(doc, { src: 'https://player.vimeo.com/video/768002424', title: 'x' });
  assert.equal(frame.getAttribute('src'), 'https://player.vimeo.com/video/768002424');
  assert.equal(createEmbedFrame(doc, { src: 'https://player.vimeo.com/video/abc', title: 'x' }), null);
  assert.equal(createEmbedFrame(doc, { src: 'https://player.vimeo.com/embed/123', title: 'x' }), null);
  assert.equal(createEmbedFrame(doc, { src: 'https://www.youtube.com/video/123', title: 'x' }), null);
  assert.equal(createEmbedFrame(doc, { src: 'https://evil.example/video/123', title: 'x' }), null);
});
