import assert from 'node:assert/strict';
import test from 'node:test';
import { lazyLoadImagesAfter } from '../scripts/lazy-load-offscreen-images.mjs';

test('keeps the initial image budget eager and defers later images', () => {
  const images = Array.from({ length: 48 }, (_, index) => `<img id="image-${index}" loading="eager">`).join('');
  const output = lazyLoadImagesAfter(images, 45);
  const tags = [...output.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);

  assert.equal(tags.slice(0, 45).every(tag => tag.includes('loading="eager"')), true);
  assert.equal(tags.slice(45).every(tag => tag.includes('loading="lazy"')), true);
});

test('keeps explicitly high-priority images eager after the initial budget', () => {
  const output = lazyLoadImagesAfter('<img fetchpriority="high" loading="eager">', 0);
  assert.match(output, /fetchpriority="high" loading="eager"/);
});

test('adds lazy loading when a later image has no loading attribute', () => {
  assert.equal(
    lazyLoadImagesAfter('<img src="story.png">', 0),
    '<img loading="lazy" src="story.png">',
  );
});
