import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPostRootSize, installPostRootSize, postRootSizeClasses } from '../scripts/post-root-size.mjs';

// Class sets read off the live article page at these root widths.
const LIVE = {
  335: 'xs lt-s lt-sm lt-md lt-lg lt-xl lte-w980 lte-post_content_area_min lte-post_content_area_small lte-banner-w1564 lte-banner-w1425 lte-banner-w1181 lte-banner-w980 lte-category-header-w1364',
  630: 'xs lt-s lt-sm lt-md lt-lg lt-xl lte-w980 lte-post_content_area_min lte-post_content_area_small lte-banner-w1564 lte-banner-w1425 lte-banner-w1181 lte-banner-w980 lte-category-header-w1364',
  720: 'sm lt-md lt-lg lt-xl gt-xs gt-s w686-745 w686-980 lte-w980 lte-post_content_area_min lte-post_content_area_small lte-banner-w1564 lte-banner-w1425 lte-banner-w1181 lte-banner-w980 lte-category-header-w1364',
  830: 'sm lt-md lt-lg lt-xl gt-xs gt-s gt-740 w686-980 lte-w980 lte-post_content_area_small lte-banner-w1564 lte-banner-w1425 lte-banner-w1181 lte-banner-w980 lte-category-header-w1364',
  960: 'sm lt-md lt-lg lt-xl gt-xs gt-s gt-740 gt-830 gt-886 gt-940 w686-980 lte-w980 lte-banner-w1564 lte-banner-w1425 lte-banner-w1181 lte-banner-w980 lte-category-header-w1364',
  980: 'md lt-lg lt-xl gt-xs gt-s gt-sm gt-740 gt-830 gt-886 gt-940 w686-980 lte-w980 lte-banner-w1564 lte-banner-w1425 lte-banner-w1181 lte-banner-w980 lte-category-header-w1364',
};

test('size classes match what live Wix puts on the post root at each width', () => {
  for (const [width, expected] of Object.entries(LIVE)) {
    assert.deepEqual([...postRootSizeClasses(Number(width))].sort(), expected.split(' ').sort(), 'width ' + width);
  }
  assert.deepEqual(postRootSizeClasses(0), []);
});

test('applying swaps only the width-dependent classes and keeps the rest', () => {
  const names = new Set('md lt-lg gt-sm gt-940 urT2WH'.split(' '));
  const root = {
    getBoundingClientRect: () => ({ width: 630 }),
    classList: Object.assign([...names], {
      add: name => names.add(name),
      remove: name => names.delete(name),
      [Symbol.iterator]: function* () { yield* [...names]; },
    }),
  };
  assert.equal(applyPostRootSize(root), true);
  assert.ok(names.has('xs') && names.has('urT2WH'));
  assert.ok(!names.has('md') && !names.has('gt-sm') && !names.has('gt-940'));
});

test('a page without a post root is left alone', () => {
  assert.equal(installPostRootSize({ querySelector: () => null }, {}), false);
});
