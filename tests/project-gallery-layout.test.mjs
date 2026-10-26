import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'parse5';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const galleryStylesheet = path.join(root, 'assets', 'project-gallery-parity.css');
const galleryScript = path.join(root, 'scripts', 'project-gallery-lightbox.mjs');
const routes = ['all-project', 'en/all-project'];

function getProjectPages() {
  return routes.flatMap((route) => {
    const routeRoot = path.join(root, route);
    return fs.readdirSync(routeRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(routeRoot, entry.name, 'index.html'))
      .filter((file) => fs.existsSync(file))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('class="pro-gallery-margin-container"'));
  });
}

test('Service mobile galleries use the measured Wix columns and section heights', () => {
  const service = fs.readFileSync(path.join(root, 'service', 'index.html'), 'utf8');
  const englishService = fs.readFileSync(path.join(root, 'en', 'service', 'index.html'), 'utf8');
  const css = fs.readFileSync(galleryStylesheet, 'utf8');

  assert.match(service, /data-deedee-service-gallery/);
  assert.match(service, /project-gallery-parity\.css/);
  assert.match(css, /data-deedee-service-gallery/);
  assert.match(css, /#comp-l9qgdb88/);
  assert.match(css, /#comp-l9qgmdrv/);
  assert.match(css, /#comp-l9qgpx94/);
  assert.match(css, /#comp-l9qgun5r/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,/);

  assert.match(englishService, /<link rel="stylesheet" data-deedee-service-gallery[^>]*project-gallery-parity\.css/);
  assert.match(englishService, /<body[^>]*data-deedee-service-gallery="true"/);
  assert.match(englishService, /<body[^>]*data-deedee-en-service-gallery="true"/);
  assert.match(css, /body\[data-deedee-en-service-gallery="true"\][\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /#comp-l9qgdb88\s*\{[^}]*height:\s*168\.75vw/s);
  assert.match(css, /#comp-l9qgmdrv\s*\{[^}]*height:\s*112\.5vw/s);
  assert.match(css, /#comp-l9qgpx94\s*\{[^}]*height:\s*168\.75vw/s);
  assert.match(css, /#comp-l9qgun5r\s*\{[^}]*height:\s*168\.75vw/s);
  assert.match(css, /grid-auto-rows:\s*56\.25vw/);
  assert.match(
    css,
    /body\[data-deedee-en-service-gallery="true"\] \.pro-gallery-margin-container \.item-hover-flex-container[\s\S]*?width:\s*100%\s*!important/,
  );
});

test('EN service galleries retain all source-verified tiles and assets', () => {
  const html = fs.readFileSync(path.join(root, 'en', 'service', 'index.html'), 'utf8');
  const expectedCounts = {
    'comp-l9qgdb88': 3,
    'comp-l9qgmdrv': 2,
    'comp-l9qgpx94': 3,
    'comp-l9qgun5r': 3,
  };
  const galleries = new Set(Object.keys(expectedCounts));
  const items = Object.fromEntries([...galleries].map((id) => [id, []]));

  const visit = (node, activeGallery = null, activeItem = null, inTitle = false) => {
    const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    const gallery = galleries.has(attrs.id) ? attrs.id : activeGallery;
    const item = attrs['data-hook'] === 'item-link-wrapper'
      ? { gallery, id: attrs['data-id'], idx: attrs['data-idx'], title: '', image: '' }
      : activeItem;
    const title = inTitle || attrs['data-hook'] === 'item-title';

    if (node.tagName === 'img' && item && attrs['data-hook'] === 'gallery-item-image-img') {
      item.image = attrs.src;
    }
    if (node.nodeName === '#text' && item && title) item.title += node.value;
    for (const child of node.childNodes ?? []) visit(child, gallery, item, title);
    if (attrs['data-hook'] === 'item-link-wrapper' && item) items[item.gallery].push(item);
  };

  visit(parse(html));
  assert.deepEqual(
    Object.fromEntries(Object.entries(items).map(([id, entries]) => [id, entries.length])),
    expectedCounts,
  );

  const expectedItems = [
    {
      gallery: 'comp-l9qgdb88',
      id: '9ed2eac6-3af9-497b-a11c-c8ed2b149285',
      idx: '2',
      title: 'DIALOGUE RECORDING',
      image: '/deedee-studio-static/assets/346f26deab1bb90937a6ffe1.png',
    },
    {
      gallery: 'comp-l9qgpx94',
      id: '8a8017bf-2697-470c-a65b-f0183a4b77ed',
      idx: '2',
      title: 'HYBRID ANIMATION',
      image: '/deedee-studio-static/assets/df6b23b0eb2f493ee5e3f927.png',
    },
    {
      gallery: 'comp-l9qgun5r',
      id: '24333271-c1f0-46e1-a3e3-75ddab0f87ea',
      idx: '2',
      title: 'EDITING',
      image: '/deedee-studio-static/assets/be8df158304c9e209352f191.png',
    },
  ];

  for (const expected of expectedItems) {
    const actual = items[expected.gallery].find(({ id }) => id === expected.id);
    assert.ok(actual, `missing Wix item ${expected.title}`);
    assert.deepEqual(actual, {
      id: expected.id,
      idx: expected.idx,
      gallery: expected.gallery,
      title: expected.title,
      image: expected.image,
    });
    assert.ok(fs.existsSync(path.join(root, expected.image.replace('/deedee-studio-static/', ''))));
  }
});

test('EN service tablet galleries keep source cards and captions inside each tile', () => {
  const css = fs.readFileSync(galleryStylesheet, 'utf8');
  const enTabletRules = css.match(
    /\/\* The EN Wix tablet gallery[\s\S]*?@media \(min-width:\s*601px\) and \(max-width:\s*1000px\) \{([\s\S]*?)^\}/m,
  )?.[1];

  assert.ok(enTabletRules, 'expected a route-specific EN tablet rule block');

  assert.match(
    enTabletRules,
    /body\[data-deedee-en-service-gallery="true"\] #comp-l9qgpx94 \.item-link-wrapper:nth-child\(n\+3\)[\s\S]*?display:\s*block\s*!important/,
  );
  assert.match(
    enTabletRules,
    /body\[data-deedee-en-service-gallery="true"\] #comp-l9qgun5r \.item-link-wrapper:nth-child\(n\+3\)[\s\S]*?display:\s*block\s*!important/,
  );
  assert.match(
    enTabletRules,
    /body\[data-deedee-en-service-gallery="true"\] \.pro-gallery-margin-container \.item-hover-flex-container[\s\S]*?height:\s*100%\s*!important[\s\S]*?width:\s*100%\s*!important/,
  );
  assert.match(
    enTabletRules,
    /body\[data-deedee-en-service-gallery="true"\] \.pro-gallery-margin-container \.info-element-text[\s\S]*?height:\s*100%\s*!important[\s\S]*?width:\s*100%\s*!important/,
  );
  assert.match(
    enTabletRules,
    /body\[data-deedee-en-service-gallery="true"\] \.pro-gallery-margin-container \.info-element-title[\s\S]*?-webkit-line-clamp:\s*2\s*!important/,
  );
});

test('The Naugh-Nice desktop gallery retains its Wix authored vertical viewport', () => {
  const css = fs.readFileSync(galleryStylesheet, 'utf8');
  const page = fs.readFileSync(path.join(root, 'all-project', 'the-naugh-nice-business', 'index.html'), 'utf8');

  assert.match(page, /data-deedee-project-gallery/);
  assert.match(css, /#comp-m7dloa7s/);
  assert.match(css, /height:\s*983\.25px/);
});


test('desktop project galleries use the Wix row height and isolate the Naugh-Nice long viewport', () => {
  const css = fs.readFileSync(galleryStylesheet, 'utf8');
  const upzi = fs.readFileSync(path.join(root, 'all-project', 'upzi', 'index.html'), 'utf8');
  const naughNice = fs.readFileSync(path.join(root, 'all-project', 'the-naugh-nice-business', 'index.html'), 'utf8');

  assert.ok(naughNice.includes('data-deedee-project-gallery-vertical="true"'));
  assert.doesNotMatch(upzi, /data-deedee-project-gallery-vertical="true"/);
  assert.ok(css.includes('body[data-deedee-project-gallery-vertical="true"] #comp-m73m1h5l #comp-m7dloa7s'));
  assert.ok(css.includes('body[data-deedee-project-gallery="true"]:not([data-deedee-project-gallery-vertical="true"]) #comp-m73m1h5l #comp-m7dloa7s'));
  assert.ok(css.includes('@media (min-width: 751px)'));
  assert.ok(css.includes('height: calc(37.5vw - 60px) !important'));
  assert.ok(css.includes('max-width: none !important'));
  assert.ok(css.includes('grid-template-rows: none !important'));
  assert.ok(css.includes('grid-auto-rows: auto !important'));
});


test('contact forms use Wix zero-scrollbar layout scaling', () => {
  for (const route of ['contact-short-form', 'contact-long-form']) {
    const page = fs.readFileSync(path.join(root, route, 'index.html'), 'utf8');
    assert.ok(page.includes('<style data-deedee-mobile-contact-parity>#SITE_CONTAINER{--scrollbar-width:0px!important;}</style>'));
  }
});


test('about page tablet team gallery matches the two-card Wix layout', () => {
  const page = fs.readFileSync(path.join(root, 'aboutus', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'assets', 'project-gallery-parity.css'), 'utf8');

  assert.ok(page.includes('data-deedee-project-gallery-parity'));
  assert.ok(css.includes('@media screen and (min-width: 751px) and (max-width: 1000px)'));
  assert.ok(css.includes('#comp-la6iaw362 [data-hook="item-container"][data-idx="0"]'));
  assert.ok(css.includes('height: 192px !important'));
  assert.ok(css.includes('height: 384px !important'));
});


test('measured responsive pages use the Wix scrollbar scale at every viewport', () => {
  for (const route of ['our-work', 'news', 'testimonials']) {
    const page = fs.readFileSync(path.join(root, route, 'index.html'), 'utf8');
    assert.ok(page.includes('<style data-deedee-responsive-scale-parity>#SITE_CONTAINER{--scrollbar-width:0px!important;}</style>'));
  }
});

test('project detail pages opt into the responsive static gallery repair', () => {
  const pages = getProjectPages();
  assert.ok(pages.length >= 50, `expected the restored project pages, found ${pages.length}`);

  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    assert.match(html, /data-deedee-project-gallery/, `${path.relative(root, page)} needs the gallery marker`);
    assert.match(html, /project-gallery-parity\.css/, `${path.relative(root, page)} needs the gallery stylesheet`);
    assert.match(html, /project-gallery-lightbox\.mjs/, `${path.relative(root, page)} needs gallery interactions`);
  }
});

test('gallery interaction module supports accessible lightbox navigation and close controls', () => {
  const script = fs.readFileSync(galleryScript, 'utf8');
  assert.match(script, /setAttribute\('role', 'dialog'\)/);
  assert.match(script, /setAttribute\('aria-modal', 'true'\)/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /ArrowDown/);
  assert.match(script, /ArrowUp/);
  assert.match(script, /setAttribute\('tabindex'/);
  assert.match(script, /Escape/);
  assert.match(script, /aria-label/);
  assert.match(script, /event\.key !== 'Tab'/);
  assert.match(script, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(script, /pageBackground\.inert = true/);
  assert.match(script, /action\.addEventListener\('keydown'/);
  assert.doesNotMatch(script, /item\.setAttribute\('role', 'button'\)/);
});

test('gallery CSS restores visible tiles and a responsive three-column grid', () => {
  const css = fs.readFileSync(galleryStylesheet, 'utf8');
  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.item-link-wrapper[^}]*position:\s*relative\s*!important/s);
  assert.match(css, /\.gallery-item-container[^}]*display:\s*block\s*!important/s);
  assert.match(css, /\.gallery-item-container[^}]*opacity:\s*1\s*!important/s);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.gallery-item-container > div:not\(\[data-hook="item-action"\]\)\s*\{[^}]*height:\s*100%\s*!important;[^}]*position:\s*absolute\s*!important/s);
  assert.match(css, /#masterPage\s*\{[^}]*--scrollbar-width:\s*15px\s*!important/s);
  assert.match(css, /\.gallery-item-wrapper[^}]*margin:\s*-5px\s*!important;[^}]*width:\s*calc\(100%\s*\+\s*10px\)\s*!important/s);
  assert.match(css, /\.gallery-item-wrapper[^}]*height:\s*calc\(100%\s*\+\s*10px\)\s*!important/s);
});

/* The lightbox ships as a plain module script with no exports, so behavioural coverage
   runs its source against a minimal document shim instead of a browser. */

class TestElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.tag = String(tag).toLowerCase();
    this.id = '';
    this.attributes = new Map();
    this.classes = new Set();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.hidden = false;
    this.inert = false;
    this.src = '';
    this.currentSrc = '';
    this.alt = '';
    this.type = '';
    this.textContent = '';
  }

  get className() { return [...this.classes].join(' '); }
  set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }

  setAttribute(name, value) {
    if (name === 'id') this.id = String(value);
    else if (name === 'class') this.className = value;
    else this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'src') this.src = '';
  }

  get classList() {
    return {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
    };
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  querySelectorAll(selector) {
    return this.descendants().filter((node) => matchesSelector(node, selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  root() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node;
  }

  focus() {
    if (isInert(this)) return;
    const doc = this.root().doc;
    if (doc) doc.activeElement = this;
  }
}

function isInert(node) {
  for (let current = node.parentNode; current; current = current.parentNode) {
    if (current.inert) return true;
  }
  return false;
}

function matchesSegment(element, segment) {
  const tokens = segment.match(/\[[^\]]+\]|#[^\s.]+|\.[^\s.[]+|^[a-zA-Z][\w-]*/) ?? [];
  return tokens.every((token) => {
    if (token.startsWith('[')) {
      const parsed = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(token);
      if (!parsed) return false;
      const value = element.getAttribute(parsed[1]);
      return parsed[2] === undefined ? value !== null : value === parsed[2];
    }
    if (token.startsWith('#')) return element.id === token.slice(1);
    if (token.startsWith('.')) return element.classes.has(token.slice(1));
    return element.tag === token.toLowerCase();
  });
}

function matchesSelector(element, selector) {
  const parts = selector.trim().split(/\s+/);
  if (!matchesSegment(element, parts[parts.length - 1])) return false;
  let pending = parts.length - 2;
  for (let node = element.parentNode; node && pending >= 0; node = node.parentNode) {
    if (matchesSegment(node, parts[pending])) pending -= 1;
  }
  return pending < 0;
}

function createDocument(gallerySizes) {
  const body = new TestElement('body');
  const doc = {
    body,
    activeElement: body,
    listeners: new Map(),
    createElement: (tag) => new TestElement(tag),
    querySelectorAll(selector) {
      return [body, ...body.descendants()].filter((node) => matchesSelector(node, selector));
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    getElementById(id) {
      return this.querySelectorAll(`#${id}`)[0] ?? null;
    },
    addEventListener(type, handler) {
      const handlers = this.listeners.get(type) ?? [];
      handlers.push(handler);
      this.listeners.set(type, handlers);
    },
  };
  body.doc = doc;
  body.setAttribute('data-deedee-project-gallery', 'true');

  const siteContainer = new TestElement('div');
  siteContainer.id = 'SITE_CONTAINER';
  body.append(siteContainer);

  doc.galleries = gallerySizes.map((size, galleryIndex) => {
    const margin = new TestElement('div');
    margin.className = 'pro-gallery-margin-container';
    siteContainer.append(margin);
    for (let index = 0; index < size; index += 1) {
      const wrapper = new TestElement('div');
      wrapper.className = 'item-link-wrapper';
      const container = new TestElement('div');
      container.className = 'gallery-item-container';
      container.setAttribute('data-hook', 'item-container');
      const action = new TestElement('div');
      action.className = 'item-action';
      action.setAttribute('data-hook', 'item-action');
      action.setAttribute('role', 'button');
      action.setAttribute('aria-haspopup', 'dialog');
      action.setAttribute('aria-label', 'image');
      // Captured Wix markup makes only the first tile of each gallery tabbable.
      action.setAttribute('tabindex', index === 0 ? '0' : '-1');
      const image = new TestElement('img');
      image.setAttribute('data-hook', 'gallery-item-image-img');
      image.src = `https://local/assets/tile-${galleryIndex}-${index}.png`;
      image.alt = '';
      action.append(image);
      container.append(action);
      wrapper.append(container);
      margin.append(wrapper);
    }
    return margin;
  });
  return doc;
}

function installLightbox(gallerySizes = [3, 5]) {
  const doc = createDocument(gallerySizes);
  new Function('document', fs.readFileSync(galleryScript, 'utf8'))(doc);
  const dialog = doc.querySelector('[role="dialog"]');
  const counter = doc.querySelector('.deedee-gallery-lightbox__counter');
  const enlargedImage = doc.querySelector('.deedee-gallery-lightbox__image');
  const actionsOf = (galleryIndex) => doc.galleries[galleryIndex]
    .querySelectorAll('[data-hook="item-container"]')
    .map((item) => item.querySelector('[data-hook="item-action"]'));
  const tabbableIndex = (galleryIndex) => actionsOf(galleryIndex).findIndex((action) => action.getAttribute('tabindex') === '0');
  return { actionsOf, counter, dialog, doc, enlargedImage, tabbableIndex };
}

function dispatch(doc, target, type, init = {}) {
  const event = {
    type,
    target,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    ...init,
  };
  const fire = (node) => (node.listeners.get(event.type) ?? []).forEach((handler) => handler(event));
  for (let node = target; node && !event.propagationStopped; node = node.parentNode) fire(node);
  if (!event.propagationStopped) fire(doc);
  return event;
}

const press = (doc, target, keyName, init = {}) => dispatch(doc, target, 'keydown', { key: keyName, ...init });
const click = (doc, target) => dispatch(doc, target, 'click');

test('arrow keys move a roving tabindex across gallery tiles without opening the dialog', () => {
  const h = installLightbox([3, 5]);
  assert.equal(h.dialog.hidden, true);
  assert.equal(h.tabbableIndex(0), 0, 'each gallery starts with one tabbable tile');
  assert.equal(h.tabbableIndex(1), 0);

  const secondGallery = h.actionsOf(1);
  press(h.doc, secondGallery[0], 'ArrowRight');
  assert.equal(h.tabbableIndex(1), 1, 'ArrowRight advances the tabbable tile');
  assert.equal(h.doc.activeElement, secondGallery[1], 'focus follows the roving tabindex');
  assert.equal(h.dialog.hidden, true, 'navigation must not open the lightbox');

  press(h.doc, secondGallery[1], 'ArrowLeft');
  assert.equal(h.tabbableIndex(1), 0);

  press(h.doc, secondGallery[0], 'ArrowDown');
  assert.equal(h.tabbableIndex(1), 1, 'ArrowDown advances like ArrowRight in the flattened tile order');
  press(h.doc, secondGallery[1], 'ArrowUp');
  assert.equal(h.tabbableIndex(1), 0, 'ArrowUp moves back');

  assert.equal(h.tabbableIndex(0), 0, 'the other gallery keeps its own roving position');

  press(h.doc, h.actionsOf(1)[4], 'ArrowRight');
  assert.equal(h.tabbableIndex(1), 0, 'ArrowRight wraps from the last tile to the first');
  press(h.doc, h.actionsOf(1)[0], 'ArrowLeft');
  assert.equal(h.tabbableIndex(1), 4, 'ArrowLeft wraps from the first tile to the last');

  press(h.doc, h.actionsOf(1)[2], 'Home');
  assert.equal(h.tabbableIndex(1), 0);
  press(h.doc, h.actionsOf(1)[0], 'End');
  assert.equal(h.tabbableIndex(1), 4);

  assert.equal(secondGallery.filter((action) => action.getAttribute('tabindex') === '0').length, 1, 'exactly one tabbable tile per gallery');
});

test('Enter and Space open the focused tile at its own position', () => {
  for (const keyName of ['Enter', ' ']) {
    const h = installLightbox([3, 5]);
    const actions = h.actionsOf(1);
    press(h.doc, actions[0], 'ArrowRight');
    press(h.doc, actions[1], 'ArrowRight');
    const event = press(h.doc, actions[2], keyName);
    assert.equal(event.defaultPrevented, true, `${keyName} must not scroll the page`);
    assert.equal(h.dialog.hidden, false, `${keyName} opens the lightbox`);
    assert.equal(h.counter.textContent, '3 / 5', `${keyName} opens the tile that has focus`);
    assert.equal(h.enlargedImage.src, 'https://local/assets/tile-1-2.png');
    assert.equal(h.tabbableIndex(1), 2, 'opening keeps roving focus on the opened tile');
    assert.equal(h.actionsOf(0).findIndex((action) => action.getAttribute('tabindex') === '0'), 0);
  }
});

test('clicking a tile still opens the lightbox and Escape restores focus to it', () => {
  const h = installLightbox([3, 5]);
  const actions = h.actionsOf(1);
  click(h.doc, actions[3]);
  const pageBackground = h.doc.getElementById('SITE_CONTAINER');
  assert.equal(h.dialog.hidden, false);
  assert.equal(h.counter.textContent, '4 / 5');
  assert.equal(h.doc.activeElement, h.dialog.querySelector('.deedee-gallery-lightbox__close'));
  assert.equal(pageBackground.inert, true, 'page background is inert while the dialog is open');
  assert.equal(pageBackground.getAttribute('aria-hidden'), 'true');
  assert.equal(h.doc.body.classList.contains('deedee-gallery-lightbox-open'), true);

  press(h.doc, h.doc.activeElement, 'Escape');
  assert.equal(h.dialog.hidden, true);
  assert.equal(h.enlargedImage.src, '', 'the enlarged image is released on close');
  assert.equal(pageBackground.inert, false);
  assert.equal(pageBackground.getAttribute('aria-hidden'), null);
  assert.equal(h.doc.body.classList.contains('deedee-gallery-lightbox-open'), false);
  assert.equal(h.doc.activeElement, actions[3], 'focus returns to the tile that opened the lightbox');
  assert.equal(h.tabbableIndex(1), 3, 'the restored tile is still tabbable');
});

test('tile order and per-gallery navigation stay scoped to the clicked gallery', () => {
  const h = installLightbox([3, 5]);
  click(h.doc, h.actionsOf(0)[2]);
  assert.equal(h.counter.textContent, '3 / 3', 'the first gallery only offers its own tiles');
  assert.equal(h.enlargedImage.src, 'https://local/assets/tile-0-2.png');

  const overlay = h.dialog.querySelector('.deedee-gallery-lightbox__next');
  click(h.doc, overlay);
  assert.equal(h.counter.textContent, '1 / 3');
  assert.equal(h.enlargedImage.src, 'https://local/assets/tile-0-0.png');
  click(h.doc, h.dialog.querySelector('.deedee-gallery-lightbox__previous'));
  assert.equal(h.counter.textContent, '3 / 3');
});

test('gallery tile keys stay inert while the dialog is open', () => {
  const h = installLightbox([3, 5]);
  const actions = h.actionsOf(1);
  click(h.doc, actions[1]);
  assert.equal(h.counter.textContent, '2 / 5');

  press(h.doc, h.doc.activeElement, 'ArrowRight');
  assert.equal(h.counter.textContent, '3 / 5', 'arrows navigate the open lightbox');

  press(h.doc, actions[1], 'ArrowRight');
  assert.equal(h.counter.textContent, '4 / 5', 'the dialog-level handler still owns arrow keys');
  assert.equal(h.tabbableIndex(1), 1, 'closed-gallery roving focus does not move behind the dialog');

  press(h.doc, actions[1], 'Enter');
  assert.equal(h.doc.activeElement, h.dialog.querySelector('.deedee-gallery-lightbox__close'), 'a tile cannot re-open the dialog while it is open');
});

test('project detail routes load the measured Wix mobile spacing repair', () => {
  const pages = getProjectPages().filter((page) => fs.readFileSync(page, 'utf8').includes('id="comp-m7r8hs8o"'));
  const stylesheet = path.join(root, 'assets', 'project-detail-mobile-parity.css');
  const css = fs.readFileSync(stylesheet, 'utf8');

  assert.equal(pages.length, 162);
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    assert.match(html, /project-detail-mobile-parity\.css/, path.relative(root, page));
  }
  assert.match(css, /#comp-m7q85i69_r_comp-m7nh18j9\s*\{[^}]*height:\s*calc\(\(100vw - var\(--scrollbar-width, 15px\)\) \* 0\.2734375\) !important;/);
  assert.match(css, /#comp-m7r8hs8o \.comp-m7r8hs8o-container/);
  assert.match(css, /#comp-m7un1qvt \.comp-m7un1qvt-container/);
});

test('careers tablet activity gallery matches the two-card Wix layout', () => {
  const html = fs.readFileSync(path.join(root, 'carrers', 'index.html'), 'utf8');
  const styles = fs.readFileSync(galleryStylesheet, 'utf8');

  assert.match(html, /project-gallery-parity\.css/);
  assert.match(styles, /#comp-m727lon0 #pro-gallery-margin-container-comp-m8ha3620/);
  assert.match(styles, /data-idx="0"/);
  assert.match(styles, /data-idx="1"/);
  assert.match(styles, /197\.375px/);
  assert.match(styles, /183px/);
  assert.match(styles, /#comp-m727lon0 \.gallery-item-common-info-outer/);
  assert.match(styles, /#comp-m8hitxkn #pro-gallery-margin-container-comp-m8hitxkn/);
  assert.match(styles, /#comp-m7t6d1e6\s*\{[^}]*height:\s*433\.375px/);
  assert.match(styles, /max-width:\s*750px/);
  assert.match(styles, /#comp-m8hitxkn #pro-gallery-comp-m8hitxkn/);
  assert.match(styles, /150\.6875px/);
  assert.match(styles, /#comp-m8hitxkn #pro-gallery-margin-container-comp-m8hitxkn \[data-hook="item-container"\] .gallery-item-wrapper/);
});

test('Tab stays trapped between the lightbox controls', () => {
  const h = installLightbox([3, 5]);
  click(h.doc, h.actionsOf(1)[0]);
  const close = h.dialog.querySelector('.deedee-gallery-lightbox__close');
  const next = h.dialog.querySelector('.deedee-gallery-lightbox__next');

  next.focus();
  const forward = press(h.doc, next, 'Tab');
  assert.equal(forward.defaultPrevented, true);
  assert.equal(h.doc.activeElement, close, 'Tab from the last control wraps to the first');

  close.focus();
  const backward = press(h.doc, close, 'Tab', { shiftKey: true });
  assert.equal(backward.defaultPrevented, true);
  assert.equal(h.doc.activeElement, next, 'Shift+Tab from the first control wraps to the last');
});

test('desktop header navigation stays horizontal in the archived Wix page', () => {
  const css = fs.readFileSync(path.join(root, 'assets', '440bd118ab3622f2cfd9ad88.css'), 'utf8');

  assert.ok(css.includes('/* DeeDee desktop navigation parity */'));
  assert.ok(css.includes('@media (min-width: 1001px)'));
  assert.ok(css.includes('.StylableHorizontalMenu3372578893__root {'));
  assert.ok(css.includes('.StylableHorizontalMenu3372578893__menu {'));
  assert.ok(css.includes('display: flex !important;'));
  assert.doesNotMatch(
    css,
    /body \.StylableHorizontalMenu3372578893__root\.StylableHorizontalMenu3372578893---menuMode-6-scroll \.StylableHorizontalMenu3372578893__menuItem \{[^}]*margin-inline-start:\s*0 !important;/,
  );
  assert.ok(css.includes('overflow-x: scroll !important;'));
});

test('footer social links retain Wix responsive icon-row sizing', () => {
  const css = fs.readFileSync(path.join(root, 'assets', '440bd118ab3622f2cfd9ad88.css'), 'utf8');

  assert.match(css, /\.eAOB3n \.tDHQQD\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.eAOB3n \.tDHQQD \.VGXFRO\s*\{[^}]*width:\s*var\(--item-size\)[^}]*height:\s*var\(--item-size\)/);
  assert.match(css, /\.eAOB3n \.tDHQQD \.VGXFRO:last-child\s*\{[^}]*margin-inline:\s*0/);
});

test('UPZI mobile detail geometry follows Wix crop and content sizing', () => {
  const css = fs.readFileSync(path.join(root, 'assets', 'project-detail-mobile-parity.css'), 'utf8');

  assert.match(css, /#comp-m7r6wfk8 img\s*\{[^}]*object-fit:\s*cover\s*!important/);
  assert.match(css, /height:\s*calc\(\(100vw - var\(--scrollbar-width,\s*15px\)\)\s*\*\s*0\.2734375\)\s*!important/);
  assert.match(css, /#comp-m7r8hs8o,\s*#comp-m7q89cml,\s*#comp-m7un1qvt\s*\{[^}]*display:\s*flex\s*!important/s);
  assert.doesNotMatch(css, /grid-template-rows:\s*(?:72\.075|75\.6858)vw/);
});
