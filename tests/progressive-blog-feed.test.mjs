import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FEED_CONFIGS,
  getNextVisibleFeedLimit,
  getProgressiveFeedMinHeight,
  getResponsiveFeedTotal,
  getResponsiveGalleryHeight,
  installProgressiveBlogFeed,
  selectInitialFeedLimit,
} from '../scripts/progressive-blog-feed.mjs';

test('activity archive follows Wix responsive counts and reserves its full eight-row gallery', () => {
  const config = {
    total: 23,
    responsiveInitials: [
      { minWidth: 1359, count: 6 },
      { minWidth: 959, count: 9 },
      { minWidth: 559, count: 12 },
      { minWidth: 479, count: 15 },
      { minWidth: 0, count: 18 },
    ],
  };
  assert.equal(getResponsiveFeedTotal(config, false, 1440), 23);
  assert.equal(getResponsiveFeedTotal(config, true, 390), 23);
  assert.equal(selectInitialFeedLimit(config, false, 1440), 6);
  assert.equal(selectInitialFeedLimit(config, false, 1350), 9);
  assert.equal(selectInitialFeedLimit(config, false, 999), 9);
  assert.equal(selectInitialFeedLimit(config, false, 900), 12);
  assert.equal(selectInitialFeedLimit(config, true, 559), 12);
  assert.equal(selectInitialFeedLimit(config, true, 520), 15);
  assert.equal(selectInitialFeedLimit(config, true, 479), 15);
  assert.equal(selectInitialFeedLimit(config, true, 432), 18);
  assert.equal(getResponsiveGalleryHeight(390, { columns: 3, rows: 8, columnGap: 10, rowGap: 10 }), 1054);
  assert.equal(getResponsiveGalleryHeight(768, { columns: 3, rows: 8, columnGap: 10, rowGap: 10 }, 15), 2022);
});

test('progressive feeds cap archive items to the responsive Wix item count', () => {
  const config = { total: 23, desktopTotal: 6, mobileTotal: 18 };
  assert.equal(getResponsiveFeedTotal(config, false), 6);
  assert.equal(getResponsiveFeedTotal(config, true), 18);
  assert.equal(getResponsiveFeedTotal({ total: 3, desktopTotal: 6 }, false), 3);
});

test('activity-category mobile feed matches Wix’s 50 cards while desktop remains capped at 40', () => {
  const category = FEED_CONFIGS.activityCategory;
  assert.equal(category.mobileInitial, 5);
  assert.equal(category.mobileTotal, 50);
  assert.equal(category.desktopTotal, 40);
  assert.equal(category.responsiveCategoryMobile, true);
  assert.equal(getResponsiveFeedTotal({ ...category, total: 50 }, true), 50);
  assert.equal(getResponsiveFeedTotal({ ...category, total: 50 }, false), 40);
  assert.equal(selectInitialFeedLimit({ ...category, total: 50 }, true, 390), 5);

  for (const width of [390, 1440]) {
    const items = Array.from({ length: 50 }, () => ({
      dataset: {},
      style: { display: '' },
      attributes: new Map(),
      getAttribute(name) { return this.attributes.get(name) ?? null; },
      hasAttribute(name) { return this.attributes.has(name); },
      setAttribute(name, value) { this.attributes.set(name, value); },
      removeAttribute(name) { this.attributes.delete(name); },
    }));
    const gallery = { clientWidth: width - 80, querySelectorAll: () => items };
    const documentRef = {
      documentElement: { scrollHeight: 10000, clientWidth: width },
      querySelector: (selector) => selector === '#gallery' ? gallery : null,
    };
    const listeners = new Map();
    const windowRef = {
      innerWidth: width,
      innerHeight: 800,
      scrollY: 0,
      matchMedia: () => ({ matches: width <= 640 }),
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: (name) => listeners.delete(name),
    };
    const config = {
      gallerySelector: '#gallery',
      itemSelector: 'article',
      desktopInitial: 6,
      mobileInitial: width === 390 ? 5 : 2,
      sourceTotal: 50,
      mobileTotal: 50,
      desktopTotal: 40,
      firstBatch: 20,
      batchSize: 20,
      desktopFirstRevealAt: 300,
      mobileFirstRevealAt: 500,
    };

    const dispose = installProgressiveBlogFeed(documentRef, windowRef, config);
    assert.equal(items.length, 50, 'all archived cards remain in the page tree');
    windowRef.scrollY = 600;
    listeners.get('scroll')();
    windowRef.scrollY = 9500;
    listeners.get('scroll')();
    listeners.get('scroll')();
    const expectedTotal = width <= 640 ? 50 : 40;
    assert.equal(items.filter((item) => item.style.display !== 'none').length, expectedTotal, `Wix feed stops at ${expectedTotal} cards for ${width}px`);
    assert.equal(items.slice(expectedTotal).filter((item) => item.style.display !== 'none').length, 0, 'archived surplus cards stay hidden');
    dispose();
  }
});

test('activity-category mobile cards use source-width squares and 12px row spacing', () => {
  assert.equal(getResponsiveGalleryHeight(350, { columns: 1, rows: 5, columnGap: 0, rowGap: 12 }), 1798);
  assert.equal(getResponsiveGalleryHeight(350, { columns: 1, rows: 20, columnGap: 0, rowGap: 12 }), 7228);
  assert.equal(getResponsiveGalleryHeight(350, { columns: 1, rows: 40, columnGap: 0, rowGap: 12 }), 14468);
  assert.equal(getResponsiveGalleryHeight(350, { columns: 1, rows: 50, columnGap: 0, rowGap: 12 }), 18088);
});

test('activity-category feed reserves height for each visible mobile batch', () => {
  const config = FEED_CONFIGS.activityCategory;
  const items = Array.from({ length: 50 }, () => ({
    dataset: {},
    style: { display: '' },
    attributes: new Map(),
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    hasAttribute(name) { return this.attributes.has(name); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  }));
  const gallery = { clientWidth: 350, querySelectorAll: () => items };
  const heightContainer = { style: {} };
  const documentRef = {
    documentElement: { scrollHeight: 10000, clientWidth: 390 },
    querySelector(selector) {
      if (selector === config.gallerySelector) return gallery;
      if (selector === config.containerSelector) return heightContainer;
      return null;
    },
  };
  const listeners = new Map();
  const windowRef = {
    innerWidth: 390,
    innerHeight: 844,
    scrollY: 0,
    matchMedia: () => ({ matches: true }),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
  };

  const dispose = installProgressiveBlogFeed(documentRef, windowRef, config);
  assert.equal(items.filter((item) => item.style.display !== 'none').length, 5);
  assert.equal(heightContainer.style.minHeight, '1798px');
  windowRef.scrollY = 600;
  listeners.get('scroll')();
  assert.equal(items.filter((item) => item.style.display !== 'none').length, 20);
  assert.equal(heightContainer.style.minHeight, '7228px');
  windowRef.scrollY = 10000;
  listeners.get('scroll')();
  listeners.get('scroll')();
  assert.equal(items.filter((item) => item.style.display !== 'none').length, 50);
  assert.equal(heightContainer.style.minHeight, '18088px');
  dispose();
});

test('activity-category mobile grid aligns its cards to the 350px Wix feed width', async () => {
  const css = await readFile(new URL('../assets/blog-category-grid.css', import.meta.url), 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\[data-hook="post-list-pro-gallery-container"\]\s*\{[^}]*margin:\s*20px\s*!important;/s);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?#pro-gallery-margin-container-pro-blog\s*\{[^}]*gap:\s*12px\s*!important;/s);
});

test('progressive feeds use the Wix initial item count for desktop and mobile', () => {
  assert.equal(selectInitialFeedLimit({ total: 23, desktopInitial: 6, mobileInitial: 18 }, false), 6);
  assert.equal(selectInitialFeedLimit({ total: 50, desktopInitial: 6, mobileInitial: 2 }, true), 2);
  assert.equal(selectInitialFeedLimit({ total: 20, desktopInitial: 20, mobileInitial: 20 }, true), 20);
});

test('progressive feeds reveal the first page and subsequent batches without exceeding the archive', () => {
  const feed = { total: 50, firstBatch: 20, batchSize: 20 };

  assert.equal(getNextVisibleFeedLimit(6, feed), 20);
  assert.equal(getNextVisibleFeedLimit(20, feed), 40);
  assert.equal(getNextVisibleFeedLimit(40, feed), 50);
  assert.equal(getNextVisibleFeedLimit(50, feed), 50);
});

test('feed gallery minimum height follows the source item batch and viewport', () => {
  const heights = {
    desktop: [[20, 2992], [40, 6016], [50, 7312]],
    mobile: [[20, 6808], [40, 13648], [50, 17068]],
  };

  assert.equal(getProgressiveFeedMinHeight(6, heights.desktop), 2992);
  assert.equal(getProgressiveFeedMinHeight(20, heights.desktop), 2992);
  assert.equal(getProgressiveFeedMinHeight(34, [[20, 2992], [34, 5152]]), 5152);
  assert.equal(getProgressiveFeedMinHeight(33, [[20, 2992], [33, 4720]]), 4720);
  assert.equal(getProgressiveFeedMinHeight(40, heights.mobile), 13648);
  assert.equal(getProgressiveFeedMinHeight(50, heights.mobile), 17068);
});

test('activity-style feeds reveal their remaining cards when the source scrolls to the bottom', () => {
  const items = Array.from({ length: 3 }, () => ({
    dataset: {},
    style: { display: '' },
    attributes: new Map(),
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    hasAttribute(name) { return this.attributes.has(name); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  }));
  const gallery = { querySelectorAll: () => items };
  const documentRef = {
    documentElement: { scrollHeight: 1000 },
    querySelector: (selector) => selector === '#gallery' ? gallery : null,
  };
  const listeners = new Map();
  const windowRef = {
    innerWidth: 1440,
    innerHeight: 800,
    scrollY: 0,
    matchMedia: () => ({ matches: false }),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
  };
  const config = {
    gallerySelector: '#gallery',
    itemSelector: 'article',
    desktopInitial: 1,
    mobileInitial: 2,
    firstBatch: 3,
    batchSize: 3,
  };

  const dispose = installProgressiveBlogFeed(documentRef, windowRef, config);
  assert.equal(items.filter((item) => item.style.display !== 'none').length, 1);
  windowRef.scrollY = 200;
  listeners.get('scroll')();
  assert.equal(items.filter((item) => item.style.display !== 'none').length, 3);
  dispose();
});

test('progressive feed restores hidden cards across viewport changes and removes listeners', () => {
  class FakeElement {
    constructor() {
      this.dataset = {};
      this.style = { display: '' };
      this.attributes = new Map();
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
  }

  const items = Array.from({ length: 4 }, () => new FakeElement());
  const gallery = { querySelectorAll: () => items };
  const heightContainer = { style: {} };
  const parent = {
    children: [],
    insertBefore(item, before) {
      this.children = this.children.filter((child) => child !== item);
      this.children.splice(this.children.indexOf(before), 0, item);
    },
  };
  const beforeSection = { parentElement: parent };
  const movedSection = { parentElement: parent };
  parent.children = [beforeSection, movedSection];
  const documentRef = {
    documentElement: { scrollHeight: 1000 },
    querySelector(selector) {
      return selector === '#gallery' ? gallery
        : selector === '#height' ? heightContainer
          : selector === '#move' ? movedSection
            : selector === '#before' ? beforeSection : null;
    },
  };
  const listeners = new Map();
  let mobile = false;
  const windowRef = {
    scrollY: 0,
    innerHeight: 600,
    matchMedia: () => ({ matches: mobile }),
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) {
      if (listeners.get(name) === handler) listeners.delete(name);
    },
  };
  const config = {
    gallerySelector: '#gallery',
    itemSelector: 'article',
    containerSelector: '#height',
    moveSelector: '#move',
    moveBeforeSelector: '#before',
    desktopInitial: 2,
    mobileInitial: 3,
    desktopTotal: 3,
    mobileTotal: 4,
    desktopFirstRevealAt: 100,
    mobileFirstRevealAt: 200,
    firstBatch: 3,
    batchSize: 1,
    desktopHeights: [[3, 300]],
    mobileHeights: [[4, 400]],
  };

  const dispose = installProgressiveBlogFeed(documentRef, windowRef, config);
  assert.deepEqual(parent.children, [movedSection, beforeSection]);
  assert.equal(items.filter((item) => item.style.display !== 'none').length, 2);
  assert.equal(items[3].getAttribute('inert'), '');
  assert.equal(heightContainer.style.minHeight, '300px');

  mobile = true;
  listeners.get('resize')();
  assert.equal(items.filter((item) => item.style.display !== 'none').length, 3);
  assert.equal(items[2].hasAttribute('inert'), false);
  assert.equal(heightContainer.style.minHeight, '400px');

  windowRef.scrollY = 300;
  listeners.get('scroll')();
  assert.equal(items.filter((item) => item.style.display !== 'none').length, 4);

  dispose();
  assert.equal(listeners.has('scroll'), false);
  assert.equal(listeners.has('resize'), false);
});
