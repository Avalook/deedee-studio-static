import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('English About Us keeps the measured Wix section heights at tablet and desktop widths', async () => {
  const [page, styles] = await Promise.all([
    readFile(path.join(ROOT, 'en/aboutus/index.html'), 'utf8'),
    readFile(path.join(ROOT, 'assets/en-aboutus-responsive-parity.css'), 'utf8'),
  ]);

  assert.ok(page.includes('en-aboutus-responsive-parity.css'));
  assert.match(styles, /max-width:\s*900px/);
  assert.match(styles, /min-width:\s*751px/);
  assert.match(styles, /min-height:\s*348px/);
  assert.match(styles, /min-height:\s*452px/);
  assert.match(styles, /min-height:\s*659px/);
  assert.match(styles, /min-height:\s*604px/);
  assert.match(styles, /min-height:\s*537px/);
  assert.match(styles, /width:\s*25%/);
  assert.match(styles, /display:\s*block\s*!important/);
  assert.doesNotMatch(styles, /nth-child\(n\s*\+\s*3\)[^{]*\{\s*display:\s*none/);
});
