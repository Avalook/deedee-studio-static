import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stylesheet = readFileSync(
  new URL('../assets/7abd70d1cb9f053ad3e8f7c7.css', import.meta.url),
  'utf8',
);
const homepage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('home news gallery hides the third card through the Wix 1100px breakpoint', () => {
  assert.match(stylesheet, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(
    stylesheet,
    /#pro-gallery-comp-m8e63qxx\s+\[data-hook="item-container"\]\[data-idx="2"\]\s*\{\s*display:\s*none\s*!important;?\s*\}/,
  );
});

test('homepage busts the cached stylesheet URL when gallery rules change', () => {
  assert.match(homepage, /7abd70d1cb9f053ad3e8f7c7\.css\?v=2/);
});
