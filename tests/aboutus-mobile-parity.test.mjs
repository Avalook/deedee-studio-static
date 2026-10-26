import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('English About Us preserves the Wix copy and 390px mobile layout', async () => {
  const [page, styles] = await Promise.all([
    readFile(path.join(ROOT, 'en/aboutus/index.html'), 'utf8'),
    readFile(path.join(ROOT, 'assets/en-aboutus-mobile-parity.css'), 'utf8'),
  ]);

  assert.ok(page.includes('en-aboutus-mobile-parity.css'));

  const intro = page.match(/id="comp-l9pnccec"[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.equal((intro.match(/<p\b/g) ?? []).length, 4, 'all four Wix intro paragraphs are present');
  assert.ok(intro.includes('DeeDee Company (under BRIDEA., JSC) is a Vietnamese animation studio'));
  assert.ok(intro.includes('We think that through creating independent animated projects immersed in Southeast Asian culture'));
  assert.ok(intro.includes('continuously pushing ourselves to new heights'));

  assert.match(styles, /@media[^{}]*max-width:\s*750px/);
  assert.match(styles, /#comp-l9pnaaou\s*\{[^}]*min-height:\s*497px/);
  assert.match(styles, /#comp-l9pnctwy\s*\{[^}]*min-height:\s*196px/);
  assert.match(styles, /#comp-l9pnod66\s*\{[^}]*min-height:\s*2771px/);
  assert.match(styles, /#comp-l9pnpcoc[\s\S]*?min-height:\s*2740px/);
  assert.match(styles, /width:\s*98px/);
  assert.match(styles, /height:\s*97px/);
  assert.match(styles, /white-space:\s*nowrap/);
});
