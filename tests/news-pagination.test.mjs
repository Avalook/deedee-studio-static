import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildNewsPageHref,
  getPaginationTarget,
  isPlainPaginationClick,
  normalizeNewsPage,
} from '../news/pagination.js';

const pages = JSON.parse(readFileSync(new URL('../news/pagination-data.json', import.meta.url), 'utf8'));

// Baseline 599e2ab lacked these Page 5 routes; the route-restoration candidate carries the exact slugs:
// /post/deedee-x-macc-master-class-with-anime-director-ito-tomohiko-2020
// /post/deedee-trip-2020
// /post/a-visiting-from-mr-frederic-alliod-2020
// /post/a-visiting-from-mr-ph%E1%BA%A1m-quang-vinh-director-of-kim-dong-publishing-house-2020
test('pagination data covers five nine-item pages with unique article routes', () => {
  assert.equal(pages.length, 5);
  assert.deepEqual(pages.map((page) => page.items.length), [9, 9, 9, 9, 9]);
  // Pins all 45 ordered source titles and paths captured from Wix; refresh only after a new source capture.
  const dataDigest = createHash('sha256').update(JSON.stringify(pages)).digest('hex');
  assert.equal(dataDigest, '78855ceb892df1d69f6636694eec9780fa3600eb123f34ca8cb106a50f90b6ec');
  assert.equal(pages[1].items[0].title, 'Liên hoan Phim Việt Nam: Trở Về - phim hoạt hình về người lính đoạt nhiều giải thưởng danh giá');
  assert.equal(decodeURIComponent(pages[1].items[0].path), '/post/trở-về-phim-hoạt-hình-về-người-lính-đoạt-nhiều-giải-thưởng-tại-liên-hoan-phim-việt-nam');
  assert.equal(pages[4].items.at(-1).title, 'A Visiting From Mr. Daniel Santos - Director of Sales - EMEA & APAC Of Toon Boom (2020)');
  const allItems = pages.flatMap((page) => page.items);
  assert.equal(new Set(allItems.map((item) => item.path)).size, 45);
  assert.ok(allItems.every((item) => item.title.trim().length > 0));
  for (const page of pages) {
    for (const item of page.items) {
      assert.match(item.path, /^\/post\//);
    }
  }
});

test('page number parsing clamps invalid routes to page one', () => {
  assert.equal(normalizeNewsPage('3'), 3);
  assert.equal(normalizeNewsPage('0'), 1);
  assert.equal(normalizeNewsPage('6'), 1);
  assert.equal(normalizeNewsPage('abc'), 1);
  assert.equal(normalizeNewsPage('2junk'), 1);
  assert.equal(normalizeNewsPage('2.5'), 1);
});

test('pagination controls resolve page, next, previous, first, and last targets', () => {
  assert.equal(getPaginationTarget('pagination__2', 1), 2);
  assert.equal(getPaginationTarget('pagination__next', 2), 3);
  assert.equal(getPaginationTarget('pagination__previous', 3), 2);
  assert.equal(getPaginationTarget('pagination__first', 3), 1);
  assert.equal(getPaginationTarget('pagination__last', 2), 5);
  assert.equal(getPaginationTarget('pagination__next', 5), null);
  assert.equal(getPaginationTarget('pagination__0', 2), null);
  assert.equal(getPaginationTarget('pagination__6', 2), null);
  assert.equal(getPaginationTarget('not-pagination', 2), null);
});

test('page links keep the current news route and base path', () => {
  assert.equal(buildNewsPageHref('/deedee-studio-static/news/', 2), '/deedee-studio-static/news/?page=2');
  assert.equal(buildNewsPageHref('/news', 5), '/news/?page=5');
});


test('modified and non-primary clicks keep native anchor behavior', () => {
  assert.equal(isPlainPaginationClick({ button: 0 }), true);
  assert.equal(isPlainPaginationClick({ button: 1 }), false);
  assert.equal(isPlainPaginationClick({ button: 0, metaKey: true }), false);
  assert.equal(isPlainPaginationClick({ button: 0, ctrlKey: true }), false);
  assert.equal(isPlainPaginationClick({ button: 0, shiftKey: true }), false);
  assert.equal(isPlainPaginationClick({ button: 0, altKey: true }), false);
});
