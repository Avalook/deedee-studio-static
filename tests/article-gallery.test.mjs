import assert from 'node:assert/strict';
import test from 'node:test';
import { collectArticleGalleryItems, wrapGalleryIndex } from '../scripts/article-gallery.mjs';

function viewer(src, alt = '') {
  const image = {
    currentSrc: '',
    src,
    alt,
    getAttribute(name) { return name === 'src' ? src : name === 'alt' ? alt : null; },
  };
  return { querySelector(selector) { return selector === 'img' ? image : null; } };
}

class FakeElement {
  constructor(tagName, doc) {
    this.tagName = tagName;
    this.ownerDocument = doc;
    this.nodeType = 1;
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.textContent = '';
    this.tabIndex = -1;
    this.parentElement = null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...children) {
    for (const child of children) { child.parentElement = this; this.children.push(child); }
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  querySelector(selector) {
    if (selector === 'img') return this.image || null;
    return this.children.find(child => child.getAttribute(selector.slice(1, -1)) !== null) || null;
  }
  querySelectorAll() { return []; }
  closest(selector) {
    if (selector === '[data-hook="image-viewer"]') return this.viewer || (this.getAttribute('data-hook') === 'image-viewer' ? this : null);
    if (selector === '[data-hook="image-expand-button"]') return null;
    if (selector === 'a, button') return null;
    return null;
  }
  focus() { this.ownerDocument.activeElement = this; }
}

function fakeDocument(viewers) {
  const doc = {
    nodeType: 9,
    activeElement: null,
    listeners: new Map(),
    documentElement: { lang: 'vi' },
    defaultView: { location: { pathname: '/post/sample' } },
    createElement(tag) { return new FakeElement(tag, doc); },
    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    },
    getElementById(id) {
      const visit = node => {
        if (node.id === id) return node;
        for (const child of node.children || []) { const found = visit(child); if (found) return found; }
        return null;
      };
      return visit(this.head) || visit(this.body);
    },
  };
  doc.head = new FakeElement('head', doc);
  doc.body = new FakeElement('body', doc);
  doc.body.style.overflow = 'scroll';
  doc.querySelectorAll = () => viewers;
  doc.addEventListener = doc.addEventListener.bind(doc);
  viewers.forEach(viewerNode => { viewerNode.ownerDocument = doc; });
  return doc;
}

function imageViewer(src, alt, doc) {
  const image = new FakeElement('img', doc);
  image.currentSrc = '';
  image.src = src;
  image.alt = alt;
  image.getAttribute = name => name === 'src' ? src : name === 'alt' ? alt : null;
  const viewerNode = new FakeElement('div', doc);
  viewerNode.setAttribute('data-hook', 'image-viewer');
  viewerNode.image = image;
  image.viewer = viewerNode;
  viewerNode.querySelector = selector => selector === 'img' ? image : null;
  return viewerNode;
}

function findAttribute(root, attribute) {
  if (root.getAttribute?.(attribute) !== null) return root;
  for (const child of root.children || []) {
    const match = findAttribute(child, attribute);
    if (match) return match;
  }
  return null;
}

test('opens the fullscreen viewer, navigates the article images, and restores focus on close', async () => {
  const { installArticleGallery } = await import('../scripts/article-gallery.mjs');
  const doc = fakeDocument([]);
  const first = imageViewer('/first.jpg', 'First image', doc);
  const second = imageViewer('/second.jpg', 'Second image', doc);
  doc.querySelectorAll = () => [first, second];
  assert.equal(installArticleGallery(doc), true);

  const click = doc.listeners.get('click')[0];
  let prevented = false;
  let stopped = false;
  click({
    target: first.image,
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
  });
  const dialog = findAttribute(doc.body, 'data-gallery-status')?.parentElement;
  const fullscreenImage = findAttribute(dialog, 'data-gallery-next')?.parentElement.children[1].children[0];
  const next = findAttribute(dialog, 'data-gallery-next');
  const previous = findAttribute(dialog, 'data-gallery-previous');
  const close = findAttribute(dialog, 'data-gallery-close');
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(dialog.hidden, false);
  assert.equal(doc.body.style.overflow, 'hidden');
  assert.equal(fullscreenImage.src, '/first.jpg');
  assert.equal(fullscreenImage.alt, 'First image');

  next.listeners.get('click')[0]();
  assert.equal(fullscreenImage.src, '/second.jpg');
  previous.listeners.get('click')[0]();
  assert.equal(fullscreenImage.src, '/first.jpg');

  doc.listeners.get('keydown').at(-1)({ key: 'ArrowLeft', preventDefault() {} });
  assert.equal(fullscreenImage.src, '/second.jpg');
  close.listeners.get('click')[0]();
  assert.equal(dialog.hidden, true);
  assert.equal(doc.body.style.overflow, 'scroll');
  assert.equal(doc.activeElement, first);
});

test('collects image-viewer items in document order and skips images without a source', () => {
  const root = { querySelectorAll() { return [viewer('/first.jpg', 'First'), viewer('', 'Empty'), viewer('/third.jpg', 'Third')]; } };
  assert.deepEqual(collectArticleGalleryItems(root), [
    { src: '/first.jpg', alt: 'First' },
    { src: '/third.jpg', alt: 'Third' },
  ]);
});

test('wraps fullscreen gallery navigation around both ends', () => {
  assert.equal(wrapGalleryIndex(0, -1, 5), 4);
  assert.equal(wrapGalleryIndex(4, 1, 5), 0);
  assert.equal(wrapGalleryIndex(2, 1, 5), 3);
  assert.equal(wrapGalleryIndex(0, 1, 0), 0);
});
