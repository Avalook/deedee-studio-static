import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getResponsiveActivityGalleryLayout } from '../scripts/progressive-blog-feed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET = 'activities-grid-responsive.css';

test('Vietnamese and English Activities pages load the same responsive gallery layout', async () => {
  const [vietnamese, english, stylesheet, mobileStyles] = await Promise.all([
    readFile(path.join(ROOT, 'activities/index.html'), 'utf8'),
    readFile(path.join(ROOT, 'en/activities/index.html'), 'utf8'),
    readFile(path.join(ROOT, 'assets/activities-grid-responsive.css'), 'utf8'),
    readFile(path.join(ROOT, 'assets/activities-vi-mobile-parity.css'), 'utf8'),
  ]);

  assert.ok(vietnamese.includes(ASSET), 'Vietnamese Activities loads the route-specific gallery layout');
  assert.ok(english.includes(ASSET), 'English Activities loads the same route-specific gallery layout');
  assert.match(vietnamese, /progressive-blog-feed\.mjs\?feed=activities-vi/);
  assert.match(english, /progressive-blog-feed\.mjs\?feed=activities(?:&|\")/);
  assert.match(stylesheet, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(stylesheet, /--deedee-activity-card-size/);
  assert.match(stylesheet, /data-hook="gallery-item-image-img"[\s\S]*?width:\s*100%\s*!important/);
  assert.match(mobileStyles, /max-width:\s*612px/);
  assert.match(mobileStyles, /min-width:\s*613px[^}]*max-width:\s*767px/s);
  assert.match(mobileStyles, /padding-left:\s*30px\s*!important/);
  assert.match(mobileStyles, /font-size:\s*15px\s*!important/);
});

test('Vietnamese Activities gallery matches single-column mobile and three-column tablet geometry', () => {
  assert.deepEqual(getResponsiveActivityGalleryLayout(390, 390, 23), {
    columns: 1,
    rows: 23,
    cardWidth: 390,
    columnGap: 0,
    rowGap: 20,
    height: 9410,
  });
  assert.deepEqual(getResponsiveActivityGalleryLayout(601, 601, 23), {
    columns: 1,
    rows: 23,
    cardWidth: 601,
    columnGap: 0,
    rowGap: 20,
    height: 14263,
  });
  assert.deepEqual(getResponsiveActivityGalleryLayout(612, 612, 23), {
    columns: 1,
    rows: 23,
    cardWidth: 612,
    columnGap: 0,
    rowGap: 20,
    height: 14516,
  });
  assert.deepEqual(getResponsiveActivityGalleryLayout(613, 613, 23), {
    columns: 2,
    rows: 12,
    cardWidth: 296,
    columnGap: 20,
    rowGap: 20,
    height: 3772,
  });
  assert.deepEqual(getResponsiveActivityGalleryLayout(650, 650, 23), {
    columns: 2,
    rows: 12,
    cardWidth: 315,
    columnGap: 20,
    rowGap: 20,
    height: 4000,
  });
  assert.deepEqual(getResponsiveActivityGalleryLayout(767, 767, 23), {
    columns: 2,
    rows: 12,
    cardWidth: 373,
    columnGap: 20,
    rowGap: 20,
    height: 4696,
  });
  assert.deepEqual(getResponsiveActivityGalleryLayout(768, 768, 23), {
    columns: 3,
    rows: 8,
    cardWidth: 249,
    columnGap: 10,
    rowGap: 10,
    height: 2062,
  });
  assert.deepEqual(getResponsiveActivityGalleryLayout(1440, 1425, 23), {
    columns: 3,
    rows: 8,
    cardWidth: 468,
    columnGap: 10,
    rowGap: 10,
    height: 3814,
  });
});


test('English Activities uses the source one-column phone gallery and keeps desktop columns', async () => {
  const [english, vietnamese] = await Promise.all([
    readFile(path.join(ROOT, 'en/activities/index.html'), 'utf8'),
    readFile(path.join(ROOT, 'activities/index.html'), 'utf8'),
  ]);

  assert.ok(english.includes('activities-en-mobile-parity.css'), 'English route loads its mobile-only parity override');
  assert.ok(!vietnamese.includes('activities-en-mobile-parity.css'), 'English mobile override stays scoped to the English route');
  const styles = await readFile(path.join(ROOT, 'assets/activities-en-mobile-parity.css'), 'utf8');
  assert.match(styles, /@media screen and \(max-width:\s*600px\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /grid-auto-rows:\s*var\(--deedee-activity-card-size\)/);
  assert.match(styles, /row-gap:\s*20px/);
});
