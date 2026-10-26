import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// /en/aboutus is the Vietnamese page (which matches live at every width) with live's English words swapped in
// by tools/visual-diff/transplant.mjs, so it needs no page-specific stylesheet of its own.
test('English About Us is the Vietnamese layout carrying the live English copy', async () => {
  const [en, vi] = await Promise.all([
    readFile(path.join(ROOT, 'en/aboutus/index.html'), 'utf8'),
    readFile(path.join(ROOT, 'aboutus/index.html'), 'utf8'),
  ]);

  assert.match(en, /<html lang="en"/);
  assert.match(en, /<title>ABOUT US \| DeeDee Studio<\/title>/);
  assert.ok(en.includes('DeeDee Company (under BRIDEA., JSC) is a Vietnamese animation studio'));
  assert.ok(en.includes('continuously pushing ourselves to new heights'));
  for (const heading of ['ABOUT US', 'CLIENTS', 'MANAGEMENT TEAM']) assert.ok(en.includes(`>${heading}<`), heading);
  assert.ok(!en.includes('VỀ CHÚNG TÔI'), 'the Vietnamese heading is gone');
  assert.ok(!en.includes('en-aboutus-'), 'the old English-only stylesheets are no longer linked');
  // Same component ids as the Vietnamese page, so the same geometry applies.
  for (const id of ['comp-la6iaw26', 'comp-la6iaw2d', 'comp-la6iaw343']) assert.ok(en.includes(`id="${id}"`) && vi.includes(`id="${id}"`), id);
});
