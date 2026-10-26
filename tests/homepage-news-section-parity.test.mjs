import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Vietnamese homepage keeps the measured Wix news section height on mobile', async () => {
  const [html, styles] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../assets/homepage-news-section-parity.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /assets\/homepage-news-section-parity\.css/);
  assert.match(styles, /@media\s+screen\s+and\s*\(min-width:\s*320px\)\s+and\s*\(max-width:\s*750px\)/);
  assert.match(styles, /#comp-m7st7as9\s*\{[^}]*min-height:\s*0\s*!important/s);
  assert.doesNotMatch(styles, /#comp-m7st7as9\s*\{[^}]*min-height:\s*591px\s*!important/s);
  assert.doesNotMatch(styles, /#comp-m7st7as9\s*\{[^}]*height:\s*591px\s*!important/s);
});


test('Vietnamese homepage restores the Wix awards gallery on mobile', async () => {
  const [html, styles, awards] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../assets/homepage-awards-gallery-parity.css', import.meta.url), 'utf8'),
    import('../scripts/homepage-awards-gallery-parity.mjs'),
  ]);

  assert.match(html, /homepage-awards-gallery-parity\.css/);
  assert.match(html, /homepage-awards-gallery-parity\.mjs/);
  for (const galleryId of awards.HOMEPAGE_AWARDS_GALLERY_IDS) {
    assert.ok(styles.includes(galleryId));
  }
  assert.match(styles, /height:\s*75px\s*!important/);
  assert.match(styles, /width:\s*100%\s*!important/);
  assert.match(styles, /calc\(100% \+ 25px\)/);
  assert.match(styles, /--deedee-award-item-width/);
  assert.match(styles, /display:\s*block\s*!important/);
  assert.match(styles, /overflow-x:\s*auto\s*!important/);
  assert.match(styles, /max-width:\s*1100px/);

  assert.equal(awards.AWARD_GALLERY_START_OFFSET_PX, 75);
  assert.equal(awards.AWARD_GALLERY_STEP_PX, 74);
  assert.equal(awards.AWARD_GALLERY_MOVE_DURATION_MS, 800);
  assert.equal(awards.AWARD_GALLERY_INTERVAL_MS, 2000);
  assert.equal(awards.awardGalleryItemWidth(368), 49);
  assert.equal(awards.awardGalleryItemWidth(728), 121);
  assert.equal(awards.awardGalleryItemWidth(874), 150);
  assert.equal(awards.awardGalleryItemWidth(950), 165);
  assert.equal(awards.awardGalleryStep(121), 146);
  assert.equal(awards.awardGalleryStartOffset(121), 147);
  assert.equal(awards.awardGalleryItemLeft(0), 0);
  assert.equal(awards.awardGalleryItemLeft(6), 444);
  assert.equal(awards.awardGalleryItemLeft(7), 518);
  assert.equal(awards.awardGalleryItemLeft(29), 2146);
  assert.equal(awards.awardGalleryItemLeft(7, 121), 1022);

  const itemValues = new Map();
  const groupValues = new Map();
  const items = Array.from({ length: 30 }, () => ({
    closest: () => ({
      style: { setProperty: (key, value) => groupValues.set(key, value) },
    }),
    style: { setProperty: (key, value) => itemValues.set(key, value) },
  }));
  const scroller = {
    clientWidth: 368,
    dataset: {},
    scrollLeft: 0,
    scrollWidth: 2308,
    addEventListener: () => {},
  };
  const galleries = new Map(awards.HOMEPAGE_AWARDS_GALLERY_IDS.map((id) => [
    id,
    {
      dataset: {},
      querySelector: () => scroller,
      querySelectorAll: () => items,
    },
  ]));
  assert.equal(awards.installHomepageAwardsGallery({
    getElementById: (id) => galleries.get(id),
  }), 3);
  assert.equal(itemValues.get('--deedee-award-item-left'), '2146px');
  assert.equal(itemValues.get('--deedee-award-item-width'), '49px');
  assert.equal(groupValues.get('--group-left'), '2146px');
  assert.equal(groupValues.get('--group-width'), '74px');
});


test('homepage awards gallery resumes after a pointer drag ends outside the scroller', async () => {
  const awards = await import('../scripts/homepage-awards-gallery-parity.mjs');
  const galleryListeners = new Map();
  const windowListeners = new Map();
  let scheduledTimers = 0;
  let clearedTimers = 0;
  const scroller = {
    clientWidth: 368,
    dataset: {},
    scrollLeft: 0,
    scrollWidth: 2308,
    addEventListener: (type, listener) => galleryListeners.set(type, listener),
    getBoundingClientRect: () => ({ bottom: 75, top: 0 }),
  };
  const fakeWindow = {
    addEventListener: (type, listener) => windowListeners.set(type, listener),
    cancelAnimationFrame: () => {},
    clearTimeout: () => { clearedTimers += 1; },
    innerHeight: 844,
    matchMedia: () => ({ addEventListener: () => {}, matches: false }),
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    setTimeout: () => { scheduledTimers += 1; return scheduledTimers; },
  };
  const gallery = {
    querySelector: (selector) => selector === '.gallery-horizontal-scroll' ? scroller : null,
    querySelectorAll: () => [],
  };
  const root = {
    defaultView: fakeWindow,
    getElementById: (id) => id === awards.HOMEPAGE_AWARDS_GALLERY_IDS[0] ? gallery : null,
  };

  assert.equal(awards.installHomepageAwardsGallery(root), 1);
  assert.equal(scheduledTimers, 1);
  galleryListeners.get('pointerdown')({ pointerId: 7 });
  galleryListeners.get('pointerdown')({ pointerId: 8 });
  assert.equal(clearedTimers, 3);

  windowListeners.get('pointerup')({ pointerId: 7 });
  assert.equal(scheduledTimers, 1);
  windowListeners.get('pointerup')({ pointerId: 8 });
  assert.equal(scheduledTimers, 2);
});
