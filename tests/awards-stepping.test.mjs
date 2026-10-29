import assert from 'node:assert/strict';
import test from 'node:test';
import { installSteppingAwardsGallery, AWARD_GALLERY_INTERVAL_MS, DESKTOP_AWARDS_GALLERY_IDS } from '../scripts/homepage-awards-gallery-parity.mjs';

/** A strip of `groups` laurels, each `width` px, with fake timers and events. */
function fixture({ groups = 4, width = 258, reduced = false } = {}) {
  const events = new Map(); const windowEvents = new Map(); const timers = new Map(); let serial = 0;
  const group = (i) => ({ style: { getPropertyValue: (key) => (key === '--group-width' ? `${width}px` : `${i * width}px`) } });
  const clone = { style: {}, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [] };
  const inner = { children: Array.from({ length: groups }, (_, i) => group(i)), cloneNode: () => clone };
  let rect = { top: 0, bottom: 80 };
  const scroller = { dataset: {}, style: {}, clientWidth: 600, scrollLeft: 0, querySelector: () => inner, append: () => {},
    addEventListener: (type, fn) => events.set(type, fn), getBoundingClientRect: () => rect };
  const gallery = { querySelector: () => scroller };
  const win = { innerHeight: 900,
    setTimeout: (fn, ms) => { timers.set(++serial, { fn, ms }); return serial; }, clearTimeout: (id) => timers.delete(id),
    addEventListener: (type, fn) => windowEvents.set(type, fn),
    matchMedia: () => ({ matches: reduced, addEventListener: (type, fn) => events.set('motion', fn) }) };
  const fire = () => { const [[id, t]] = timers; timers.delete(id); assert.equal(t.ms, AWARD_GALLERY_INTERVAL_MS); t.fn(); };
  return { gallery, win, scroller, clone, events, windowEvents, timers, fire, setRect: (r) => { rect = r; } };
}

test('desktop award strips advance one laurel every 2 s and loop seamlessly', () => {
  assert.deepEqual(DESKTOP_AWARDS_GALLERY_IDS, ['pro-gallery-comp-m6xt2xqy', 'pro-gallery-comp-m6xtc7dq']);
  const f = fixture();
  assert.equal(installSteppingAwardsGallery(f.gallery, f.win), true);
  assert.equal(f.clone.style.left, '1032px', 'the copy starts right after the 4 x 258px originals');
  assert.equal(f.scroller.scrollLeft, 0, 'nothing moves before the first 2 s');
  const seen = []; for (let i = 0; i < 6; i++) { f.fire(); seen.push(f.scroller.scrollLeft); }
  assert.deepEqual(seen, [258, 516, 774, 0, 258, 516], 'one laurel per tick, wrapping by exactly one cycle');
  assert.equal(installSteppingAwardsGallery(f.gallery, f.win), false, 'installs once');
});

test('the strip waits while hovered, dragged, focused, offscreen or with reduced motion', () => {
  const f = fixture(); installSteppingAwardsGallery(f.gallery, f.win);
  f.events.get('pointerenter')(); assert.equal(f.timers.size, 0);
  f.events.get('pointerleave')(); assert.equal(f.timers.size, 1);
  f.events.get('pointerdown')({ pointerId: 7 }); assert.equal(f.timers.size, 0);
  f.windowEvents.get('pointerup')({ pointerId: 7 }); assert.equal(f.timers.size, 1);
  f.events.get('focusin')(); assert.equal(f.timers.size, 0);
  f.events.get('focusout')(); assert.equal(f.timers.size, 1);
  f.events.get('motion')({ matches: true }); assert.equal(f.timers.size, 0);
  f.events.get('motion')({ matches: false }); assert.equal(f.timers.size, 1);
  f.setRect({ top: 1000, bottom: 1080 }); f.windowEvents.get('scroll')(); assert.equal(f.timers.size, 0);
  f.setRect({ top: 0, bottom: 80 }); f.windowEvents.get('resize')(); assert.equal(f.timers.size, 1);
  const reduced = fixture({ reduced: true }); installSteppingAwardsGallery(reduced.gallery, reduced.win);
  assert.equal(reduced.timers.size, 0, 'reduced motion never starts the strip');
});
