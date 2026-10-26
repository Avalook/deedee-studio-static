import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../our-work/index.html', import.meta.url), 'utf8');

test('numbered tab query parameters do not override Wix default tab on direct load', () => {
  assert.doesNotMatch(page, /new URLSearchParams\(location\.search\)\.get\(['"]tab['"]\)/);
  assert.doesNotMatch(page, /const requestedTab =/);
});

test('clicking a category tab records the Wix-style label in browser history', () => {
  assert.match(page, /history\.pushState\(/);
  assert.match(page, /\?\.=/);
});
