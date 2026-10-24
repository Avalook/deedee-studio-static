import assert from 'node:assert/strict';
import test from 'node:test';
import { focalPosition } from '../scripts/background-layout.mjs';

test('centers the authored mobile focal point inside the cover crop', () => {
  const [x, y] = focalPosition(1563, 1813, 390, 722, 49, 17);
  assert.ok(x > 47 && x < 48, `mobile x=${x}`);
  assert.equal(y, 0);
});

test('clamps desktop curves to their authored top edge', () => {
  assert.deepEqual(focalPosition(1454, 883, 1885, 736, 47, 26), [0, 0]);
  assert.deepEqual(focalPosition(1454, 1308, 1885, 1078, 47, 25), [0, 0]);
});

test('resizes across orientations without moving the focal point out of range', () => {
  for (const width of [390, 768, 1366, 1885]) {
    const position = focalPosition(1563, 1813, width, 722, 49, 17);
    assert.ok(position.every(value => value >= 0 && value <= 100));
  }
  assert.deepEqual(focalPosition(100, 100, 50, 200, 100, 100), [100, 0]);
});

test('does not process hidden or invalid layout dimensions', () => {
  assert.equal(focalPosition(100, 100, 0, 100, 50, 50), null);
  assert.equal(focalPosition(NaN, 100, 100, 100, 50, 50), null);
});


test('updates observed backgrounds on container resize and skips hidden ones', async () => {
  const { observeBackgrounds } = await import('../scripts/background-layout.mjs');
  const container = { getBoundingClientRect: () => ({ width: 390, height: 722 }) };
  const image = { dataset: { deedeeBackground: JSON.stringify({ width: 1563, height: 1813, x: 49, y: 17 }) }, parentElement: container, style: {} };
  let notify;
  const observed = [];
  class Observer {
    constructor(callback) { notify = callback; }
    observe(target) { observed.push(target); }
  }
  observeBackgrounds({ querySelectorAll: () => [image] }, Observer);
  assert.equal(observed[0], container);
  assert.match(image.style.objectPosition, /^47\./);
  const initialPosition = image.style.objectPosition;
  container.getBoundingClientRect = () => ({ width: 390, height: 0 });
  notify([{ target: container }]);
  assert.match(image.style.objectPosition, /^47\./);
  container.getBoundingClientRect = () => ({ width: 390, height: 681 });
  notify([{ target: container }]);
  assert.notEqual(image.style.objectPosition, initialPosition);
});
