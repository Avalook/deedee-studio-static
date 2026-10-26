import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const stylesheet = readFileSync(
  new URL('../assets/7abd70d1cb9f053ad3e8f7c7.css', import.meta.url),
  'utf8',
);
const homepage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Wix builds the third news card only after the gallery scrolls into view, so a load-time
// measurement sees two cards. After scrolling, live shows all three at 1440, 1037, 787 and 419px.
test('home news gallery keeps the third card visible at every breakpoint', () => {
  assert.doesNotMatch(
    stylesheet,
    /#pro-gallery-comp-m8e63qxx\s+\[data-hook="item-container"\]\[data-idx="2"\]\s*\{[^}]*display:\s*none/,
  );
  assert.doesNotMatch(homepage, /pgif[0-9a-f]+_2\s*\{\s*display:\s*none/);
});

test('homepage busts the cached stylesheet URL when gallery rules change', () => {
  assert.match(homepage, /7abd70d1cb9f053ad3e8f7c7\.css\?v=6/);
});
