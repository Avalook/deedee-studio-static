import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { repairTransformedAssets, stripWixAssetTransforms } from '../scripts/repair-transformed-assets.mjs';

test('removes Wix image transform suffixes when the local source asset exists', () => {
  const html = '<img src="/deedee-studio-static/assets/logo.png/v1/fill/w_145,h_44/logo.png">';
  const result = stripWixAssetTransforms(html, () => true);

  assert.deepEqual(result, {
    html: '<img src="/deedee-studio-static/assets/logo.png">',
    rewritten: 1,
    skipped: 0
  });
});

test('rewrites multiple srcset and CSS asset URLs without changing surrounding markup', () => {
  const html = '<img srcset="/assets/photo.webp/v1/fill/w_200,h_120/photo.webp 200w, /assets/photo.webp/v1/fill/w_400,h_240/photo.webp 400w" style="background-image:url(/assets/logo.png/v1/fill/w_80,h_20/logo.png)">';
  const result = stripWixAssetTransforms(html, () => true);

  assert.equal(result.rewritten, 3);
  assert.equal(result.skipped, 0);
  assert.equal(result.html, '<img srcset="/assets/photo.webp 200w, /assets/photo.webp 400w" style="background-image:url(/assets/logo.png)">');
});

test('keeps transformed paths if the corresponding local file is unavailable', () => {
  const html = '<img src="/assets/missing.png/v1/fill/w_100/missing.png">';
  const result = stripWixAssetTransforms(html, () => false);

  assert.deepEqual(result, { html, rewritten: 0, skipped: 1 });
});

test('leaves ordinary assets and non-local Wix URLs untouched', () => {
  const html = '<img src="/assets/logo.png"><img src="https://static.wixstatic.com/media/id/v1/fill/w_80/logo.png">';
  const result = stripWixAssetTransforms(html, () => true);

  assert.deepEqual(result, { html, rewritten: 0, skipped: 0 });
});

test('repairs manifest pages only when the local asset exists and is idempotent', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deedee-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'assets', 'logo.png'), 'asset');
  fs.writeFileSync(path.join(root, 'index.html'), '<img src="/deedee-studio-static/assets/logo.png/v1/fill/w_80,h_20/logo.png"><img src="/assets/missing.png/v1/fill/w_80,h_20/missing.png">');
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ pages: [{ file: 'index.html' }] }));

  const first = repairTransformedAssets(root);
  assert.deepEqual(first, { pagesChanged: 1, referencesRewritten: 1, referencesSkipped: 1 });
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), '<img src="/deedee-studio-static/assets/logo.png"><img src="/assets/missing.png/v1/fill/w_80,h_20/missing.png">');
  assert.deepEqual(repairTransformedAssets(root), { pagesChanged: 0, referencesRewritten: 0, referencesSkipped: 1 });
});

test('rejects manifest pages that escape the site root', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deedee-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ pages: [{ file: '../outside.html' }] }));

  assert.throws(() => repairTransformedAssets(root), /escapes the site root/);
});

test('rejects malformed manifest and missing page entries', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deedee-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifestPath = path.join(root, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ pages: {} }));
  assert.throws(() => repairTransformedAssets(root), /pages array/);

  fs.writeFileSync(manifestPath, JSON.stringify({ pages: [{ file: 'missing.html' }] }));
  assert.throws(() => repairTransformedAssets(root), /Manifest page is missing/);
});
