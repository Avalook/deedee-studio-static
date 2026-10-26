import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PARTNER_BASE_LOGO_HEIGHT,
  PARTNER_GALLERY_OVERHANG,
  PARTNER_ROW_HEIGHT,
  PARTNER_SMALL_LOGO_HEIGHT,
  advanceMarquee,
  canAdvanceMarquee,
  partnerCycleWidth,
  EXTRA_PARTNER_LOGOS,
  partnerGroupLayout,
  partnerLogoCount,
  partnerGalleryIsVisible,
  partnerGalleryRowHeight,
  partnerItemTop,
  partnerRowHeight,
  partnerViewportScale,
  partnerWidgetWidthPercent,
  scaledPartnerLength,
  startAnimation,
  updatePartnerGalleryVisibility,
} from '../scripts/partner-marquee.mjs';



test('responsive partner groups preserve the source 15px side margins', () => {
  const sourceGroups = [
    { left: 0, width: 329, items: [{ width: 299 }] },
    { left: 329, width: 104, items: [{ width: 74 }] },
    { left: 433, width: 232, items: [{ width: 202 }] },
  ];

  assert.deepEqual(
    sourceGroups.map((group, index) => partnerGroupLayout(group, index, 0.375)),
    [
      { left: 0, width: 142.125 },
      { left: 142.125, width: 57.75 },
      { left: 199.875, width: 105.75 },
    ],
  );
});

test('the archive follows Wix 25-logo tablet and 36-logo desktop layouts', () => {
  assert.equal(EXTRA_PARTNER_LOGOS.length, 11);
  assert.deepEqual(
    EXTRA_PARTNER_LOGOS.map(logo => logo.width),
    [529, 392, 247, 166, 541, 102, 175, 108, 439, 287, 286],
  );
  assert.equal(partnerLogoCount(390), 25);
  assert.equal(partnerLogoCount(750), 25);
  assert.equal(partnerLogoCount(751), 25);
  assert.equal(partnerLogoCount(1024), 25);
  assert.equal(partnerLogoCount(1100), 25);
  assert.equal(partnerLogoCount(1101), 36);
  assert.equal(partnerLogoCount(1440), 36);
});

const DESKTOP_GROUPS = [
  { left: 0, width: 329 },
  { left: 329, width: 104 },
  { left: 6266, width: 102 },
];

test('small viewports scale the 80px source logos down to 50px', () => {
  assert.equal(PARTNER_BASE_LOGO_HEIGHT, 80);
  assert.equal(PARTNER_SMALL_LOGO_HEIGHT, 50);
  assert.equal(partnerViewportScale(390), 0.625);
  assert.equal(partnerViewportScale(750), 0.625);
  assert.equal(partnerViewportScale(751), 0.375);
  assert.equal(partnerViewportScale(1024), 0.375);
  assert.equal(partnerViewportScale(1100), 0.375);
  assert.equal(partnerViewportScale(1101), 1);
  assert.equal(partnerViewportScale(1440), 1);
  assert.equal(partnerViewportScale(NaN), 1);
  assert.equal(partnerViewportScale(0), 1);
  assert.equal(partnerWidgetWidthPercent(750), 100);
  assert.equal(partnerWidgetWidthPercent(1100), 100);
  assert.equal(partnerWidgetWidthPercent(1101), 200);
  assert.equal(partnerWidgetWidthPercent(1440), 200);
  assert.equal(partnerWidgetWidthPercent(NaN), 100);
});

test('scaled partner lengths keep the source aspect ratios', () => {
  assert.equal(scaledPartnerLength(299, 0.625), 186.875);
  assert.equal(scaledPartnerLength(74, 0.625), 46.25);
  assert.equal(scaledPartnerLength(80, 0.625), 50);
  assert.equal(scaledPartnerLength(329, 1), 329);
  assert.equal(scaledPartnerLength(NaN, 0.625), 0);
  assert.equal(scaledPartnerLength(329, 0), 0);
});

test('the loop cycle is computed from resized geometry', () => {
  assert.equal(partnerCycleWidth(DESKTOP_GROUPS, 1), 6368);
  assert.equal(partnerCycleWidth(DESKTOP_GROUPS, 0.625), 3980);
  assert.equal(partnerCycleWidth([], 1), 0);
  assert.equal(partnerCycleWidth(undefined, 1), 0);
});

test('row height follows the original Wix breakpoint', () => {
  assert.equal(PARTNER_ROW_HEIGHT, 80);
  assert.equal(partnerRowHeight(390), 50);
  assert.equal(partnerRowHeight(750), 50);
  assert.equal(partnerRowHeight(751), 30);
  assert.equal(partnerRowHeight(1024), 30);
  assert.equal(partnerRowHeight(1100), 30);
  assert.equal(partnerRowHeight(1101), 80);
  assert.equal(partnerRowHeight(1440), 80);
  assert.equal(partnerRowHeight(NaN), 80);
  assert.equal(partnerRowHeight(0), 80);
  assert.equal(partnerItemTop(partnerRowHeight(1440), PARTNER_BASE_LOGO_HEIGHT), 15);
  assert.equal(partnerItemTop(partnerRowHeight(390), PARTNER_SMALL_LOGO_HEIGHT), 15);
  assert.equal(partnerItemTop(partnerRowHeight(1024), 30), 15);
  assert.equal(partnerItemTop(NaN, 50), 0);
});

// Wix measured at 518: widget 50 / outer+gallery 65 / gallery width viewport + 30.
// Wix measured at 1440 by the same +15 rule: widget 80 / gallery 95.
test('scroll strip keeps the Wix overhang and never clips a logo', () => {
  assert.equal(PARTNER_GALLERY_OVERHANG, 15);
  assert.equal(partnerGalleryRowHeight(390), 65);
  assert.equal(partnerGalleryRowHeight(750), 65);
  assert.equal(partnerGalleryRowHeight(800), 45);
  assert.equal(partnerGalleryRowHeight(1024), 45);
  assert.equal(partnerGalleryRowHeight(1440), 95);
  assert.equal(partnerGalleryRowHeight(NaN), 95);

  assert.equal(partnerWidgetWidthPercent(390), 100);
  assert.equal(partnerWidgetWidthPercent(1024), 100);
  assert.equal(partnerWidgetWidthPercent(1101), 200);
  assert.equal(partnerWidgetWidthPercent(1440), 200);

  for (const width of [390, 750, 751, 800, 1024, 1100, 1101, 1440]) {
    const row = partnerRowHeight(width);
    const logo = scaledPartnerLength(PARTNER_BASE_LOGO_HEIGHT, partnerViewportScale(width));
    const top = partnerItemTop(row, logo);
    assert.equal(logo, row, `the ${width}px row must scale the 80px source logo to its own height`);
    assert.equal(top, PARTNER_GALLERY_OVERHANG);
    assert.ok(top + logo <= partnerGalleryRowHeight(width), `logos must stay inside the ${width}px strip`);
  }
});

test('reduced motion and user state block automatic marquee movement', () => {
  const visible = {
    reducedMotion: false,
    paused: false,
    visibilityState: 'visible',
    hasPreviousFrame: true,
    cycleWidth: 3980,
  };
  assert.equal(canAdvanceMarquee(visible), true);
  assert.equal(canAdvanceMarquee({ ...visible, reducedMotion: true }), false);
  assert.equal(canAdvanceMarquee({ ...visible, paused: true }), false);
  assert.equal(canAdvanceMarquee({ ...visible, inViewport: false }), false);
  assert.equal(canAdvanceMarquee({ ...visible, visibilityState: 'hidden' }), false);
  assert.equal(canAdvanceMarquee({ ...visible, hasPreviousFrame: false }), false);
  assert.equal(canAdvanceMarquee({ ...visible, cycleWidth: 0 }), false);
});

test('gallery visibility requires an intersection with the viewport', () => {
  assert.equal(partnerGalleryIsVisible({ left: 10, right: 110, top: 10, bottom: 60 }, 390, 844), true);
  assert.equal(partnerGalleryIsVisible({ left: -110, right: -1, top: 10, bottom: 60 }, 390, 844), false);
  assert.equal(partnerGalleryIsVisible({ left: 10, right: 110, top: 844, bottom: 900 }, 390, 844), false);
});

test('offscreen gallery waits to animate and stops until it re-enters view', () => {
  const harness = createMarqueeHarness(false);
  const { state } = harness;
  state.inViewport = false;

  startAnimation(state);
  assert.equal(harness.pendingFrameCount(), 0);

  updatePartnerGalleryVisibility(state, true);
  assert.equal(harness.pendingFrameCount(), 1);
  harness.runFrame(16);
  assert.equal(harness.pendingFrameCount(), 1);

  updatePartnerGalleryVisibility(state, false);
  assert.equal(state.animationStarted, false);
  assert.equal(state.lastFrame, 0);
  assert.equal(harness.pendingFrameCount(), 0);

  updatePartnerGalleryVisibility(state, true);
  assert.equal(harness.pendingFrameCount(), 1);
});

test('IntersectionObserver starts and cancels the ticker on visibility changes', () => {
  const harness = createMarqueeHarness(false);
  const { state } = harness;
  state.inViewport = false;
  harness.installIntersectionObserver();

  startAnimation(state);
  assert.equal(harness.observedGallery(), state.gallery);
  assert.equal(harness.pendingFrameCount(), 0);

  harness.triggerIntersection(true);
  assert.equal(harness.pendingFrameCount(), 1);
  harness.runFrame(16);
  harness.triggerIntersection(false);
  assert.equal(state.animationStarted, false);
  assert.equal(harness.pendingFrameCount(), 0);
});

test('scroll fallback starts and stops the ticker as the gallery crosses the viewport', () => {
  const harness = createMarqueeHarness(false);
  const { state } = harness;
  state.inViewport = false;
  harness.setGalleryBounds({ left: 0, right: 100, top: 900, bottom: 950 });

  startAnimation(state);
  assert.equal(harness.pendingFrameCount(), 0);

  harness.setGalleryBounds({ left: 0, right: 100, top: 800, bottom: 844 });
  harness.dispatchWindowEvent('scroll');
  assert.equal(harness.pendingFrameCount(), 1);

  harness.setGalleryBounds({ left: 0, right: 100, top: 900, bottom: 950 });
  harness.dispatchWindowEvent('scroll');
  assert.equal(state.animationStarted, false);
  assert.equal(harness.pendingFrameCount(), 0);
});

test('resize fallback recomputes visibility after responsive layout', () => {
  const harness = createMarqueeHarness(false);
  const { state } = harness;
  let visibleAfterLayout = false;
  let layoutMadeGalleryVisible = false;
  state.inViewport = false;
  state.containers = [];
  state.groupStyles = [];
  state.groups = [];
  state.parent = { style: {} };
  state.outer = { style: {} };
  state.widget = { style: {} };
  state.track = { style: {}, querySelectorAll: () => [], append: () => {} };
  state.gallery.style = {};
  Object.defineProperty(state.gallery.style, 'height', {
    set: () => { layoutMadeGalleryVisible = visibleAfterLayout; },
  });
  state.gallery.getBoundingClientRect = () => layoutMadeGalleryVisible
    ? { left: 0, right: 100, top: 800, bottom: 844 }
    : { left: 0, right: 100, top: 900, bottom: 950 };

  startAnimation(state);
  visibleAfterLayout = true;
  harness.dispatchWindowEvent('resize');
  assert.equal(harness.pendingFrameCount(), 1);

  visibleAfterLayout = false;
  harness.dispatchWindowEvent('resize');
  assert.equal(state.animationStarted, false);
  assert.equal(harness.pendingFrameCount(), 0);
});

function createMarqueeHarness(initiallyReducedMotion) {
  let onPreferenceChange;
  let nextFrameId = 0;
  let galleryBounds = { left: 0, right: 100, top: 0, bottom: 50 };
  let intersectionCallback;
  let observedGallery;
  const frames = new Map();
  const galleryListeners = new Map();
  const windowListeners = new Map();
  const state = {
    animationStarted: false,
    animationFrameId: 0,
    inViewport: true,
    doc: {
      visibilityState: 'visible',
      addEventListener: () => {},
    },
    gallery: {
      dataset: { deedeeMarqueeCycle: '100' },
      scrollLeft: 0,
      addEventListener: (type, listener) => {
        const listeners = galleryListeners.get(type) ?? [];
        listeners.push(listener);
        galleryListeners.set(type, listeners);
      },
      contains: () => false,
      getBoundingClientRect: () => galleryBounds,
    },
    lastFrame: 0,
    listenersInstalled: false,
    motionQuery: {
      addEventListener: (type, listener) => {
        assert.equal(type, 'change');
        onPreferenceChange = listener;
      },
    },
    paused: false,
    position: 0,
    reducedMotion: initiallyReducedMotion,
    win: {
      innerWidth: 390,
      innerHeight: 844,
      addEventListener: (type, listener) => {
        const listeners = windowListeners.get(type) ?? [];
        listeners.push(listener);
        windowListeners.set(type, listeners);
      },
      requestAnimationFrame: callback => {
        const id = ++nextFrameId;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: id => frames.delete(id),
    },
    written: false,
  };

  return {
    state,
    changePreference(matches) {
      assert.equal(typeof onPreferenceChange, 'function');
      onPreferenceChange({ matches });
    },
    dispatchGalleryEvent(type, event = {}) {
      for (const listener of galleryListeners.get(type) ?? []) listener(event);
    },
    dispatchWindowEvent(type) {
      for (const listener of windowListeners.get(type) ?? []) listener();
    },
    setGalleryBounds(bounds) {
      galleryBounds = bounds;
    },
    installIntersectionObserver() {
      state.win.IntersectionObserver = class {
        constructor(callback) {
          intersectionCallback = callback;
        }
        observe(gallery) {
          observedGallery = gallery;
        }
      };
    },
    triggerIntersection(isIntersecting) {
      assert.equal(typeof intersectionCallback, 'function');
      intersectionCallback([{ isIntersecting }]);
    },
    observedGallery: () => observedGallery,
    pendingFrameCount: () => frames.size,
    runFrame(time) {
      const next = frames.entries().next().value;
      assert.ok(next, 'expected one queued animation frame');
      const [id, callback] = next;
      frames.delete(id);
      callback(time);
    },
  };
}

test('reduced motion stops and resumes one real animation frame loop', () => {
  const harness = createMarqueeHarness(true);
  const { state } = harness;

  startAnimation(state);
  assert.equal(state.listenersInstalled, true);
  assert.equal(state.animationStarted, false);
  assert.equal(harness.pendingFrameCount(), 0);

  harness.changePreference(false);
  assert.equal(state.animationStarted, true);
  assert.equal(state.gallery.dataset.deedeeMarqueeAnimation, 'enabled');
  assert.equal(harness.pendingFrameCount(), 1);
  harness.changePreference(false);
  assert.equal(harness.pendingFrameCount(), 1, 'resume must not create a second loop');

  harness.runFrame(16);
  assert.equal(state.position, 0, 'the first frame only establishes a timestamp');
  assert.equal(harness.pendingFrameCount(), 1);
  harness.runFrame(32);
  assert.ok(state.position > 0, 'the active loop should advance the track');
  const positionAtPause = state.position;
  assert.equal(harness.pendingFrameCount(), 1);

  harness.changePreference(true);
  assert.equal(state.reducedMotion, true);
  assert.equal(state.gallery.dataset.deedeeMarqueeAnimation, 'reduced-motion');
  assert.equal(state.lastFrame, 0);
  harness.runFrame(48);
  assert.equal(state.animationStarted, false);
  assert.equal(state.position, positionAtPause, 'the queued frame must not move the track');
  assert.equal(harness.pendingFrameCount(), 0, 'the loop must stop scheduling frames');

  harness.changePreference(false);
  assert.equal(state.animationStarted, true);
  assert.equal(harness.pendingFrameCount(), 1);
  harness.changePreference(false);
  assert.equal(harness.pendingFrameCount(), 1, 'a repeated resume must not duplicate the loop');
  harness.runFrame(64);
  harness.runFrame(80);
  assert.ok(state.position > positionAtPause, 'disabling reduced motion should resume movement');
  assert.equal(harness.pendingFrameCount(), 1);
});

test('the marquee advances 100px per 2.5s and wraps at one cycle', () => {
  assert.equal(advanceMarquee(0, 2500, 3980), 100);
  assert.equal(advanceMarquee(100, 2500, 3980), 200);
  assert.equal(advanceMarquee(3900, 2500, 3980), 20);
  assert.equal(advanceMarquee(0, 2500, 3980, 0.5), 200);
  assert.equal(advanceMarquee(0, 0, 3980), 0);
  assert.equal(advanceMarquee(0, 1000, 0), 0);
  assert.equal(advanceMarquee(NaN, 1000, 3980), 0);
});

test('desktop hover pauses and resumes the existing animation frame loop', () => {
  const harness = createMarqueeHarness(false);
  const { state } = harness;

  startAnimation(state);
  harness.runFrame(16);
  harness.runFrame(32);
  const positionAtHover = state.position;
  assert.ok(positionAtHover > 0);

  harness.dispatchGalleryEvent('pointerenter');
  assert.equal(state.paused, true);
  assert.equal(harness.pendingFrameCount(), 1);
  harness.runFrame(1000);
  assert.equal(state.position, positionAtHover, 'hover must pause movement');

  harness.dispatchGalleryEvent('pointerleave');
  assert.equal(state.paused, false);
  assert.equal(state.lastFrame, 0);
  harness.runFrame(2000);
  assert.equal(state.position, positionAtHover, 'resume should establish a fresh frame time');
  harness.runFrame(2025);
  assert.ok(state.position > positionAtHover, 'leaving hover should resume movement');
  assert.equal(harness.pendingFrameCount(), 1);
});

test('touch drag remains paused through pointercancel until touchend', () => {
  const harness = createMarqueeHarness(false);
  const { state } = harness;

  startAnimation(state);
  harness.runFrame(16);
  harness.runFrame(32);
  const positionAtDrag = state.position;
  assert.ok(positionAtDrag > 0);

  harness.dispatchGalleryEvent('pointerdown', { pointerType: 'touch' });
  assert.equal(state.paused, true, 'touch input should stop auto-scroll while dragging');
  harness.dispatchGalleryEvent('pointerleave', { pointerType: 'touch' });
  assert.equal(state.paused, true, 'leaving the gallery during a drag must not restart auto-scroll');

  harness.dispatchGalleryEvent('pointercancel', { pointerType: 'touch' });
  assert.equal(state.paused, true, 'pointer cancellation during native scrolling must not end the touch drag');
  harness.runFrame(1000);
  assert.equal(state.position, positionAtDrag, 'auto-scroll must not compete with touch drag');

  harness.dispatchGalleryEvent('touchend');
  assert.equal(state.paused, false, 'touch release should resume auto-scroll');
  assert.equal(state.lastFrame, 0);
  harness.runFrame(2000);
  harness.runFrame(2025);
  assert.ok(state.position > positionAtDrag);
  assert.equal(harness.pendingFrameCount(), 1);
});

test('a float accumulator keeps 60fps playback at 40px/s', () => {
  const step = (position, elapsedMs) => advanceMarquee(position, elapsedMs, 3980);
  let position = 0;
  for (let frame = 0; frame < 180; frame++) position = step(position, 1000 / 60);
  assert.equal(Math.round(position / (180 / 60)), 40);

  // Reading back the rounded scrollLeft each frame biases every step up to a whole pixel.
  let scrolled = 0;
  for (let frame = 0; frame < 180; frame++) scrolled = Math.round(step(scrolled, 1000 / 60));
  assert.equal(Math.round(scrolled / (180 / 60)), 60);
});


test('both homepages load the partner marquee controller', () => {
  for (const file of ['index.html', 'en/index.html']) {
    const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(html, /comp-m6vwcy1k/);
    assert.match(html, /data-deedee-media-motion/);
  }
});
