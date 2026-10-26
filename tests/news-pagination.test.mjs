import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  NEWS_PAGE_INDICES,
  applyResponsiveNewsGalleryLayout,
  NEWS_UNARCHIVED_ACTIVITY_ITEMS,
  getNewsPageCount,
  getNewsPageIndices,
  getResponsiveNewsGalleryLayout,
  newsLanguageFor,
  NEWS_PAGE_INDICES_EN,
  NEWS_UNARCHIVED_ITEMS_EN,
} from '../scripts/news-pagination.mjs';

import { createHash } from 'node:crypto';
import {
  buildNewsPageHref,
  getPaginationTarget,
  isPlainPaginationClick,
  normalizeNewsPage,
} from '../news/pagination.js';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('activity tab matches the freshly captured six Wix pages', () => {
  assert.deepEqual(getNewsPageIndices('activity', 1), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(getNewsPageIndices('activity', 2), [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual(getNewsPageIndices('activity', 3), [18, 19, 20, 21, 22, 23, 24, 25, 26]);
  assert.deepEqual(getNewsPageIndices('activity', 4), [27, 28, 29, 30, 31, 32, 33, 34, 35]);
  assert.deepEqual(getNewsPageIndices('activity', 5), [36, 37, 38, 39, 40, 41, 42, 43, 44]);
  assert.deepEqual(getNewsPageIndices('activity', 6), [45, 46, 47, 48, 49]);
  assert.equal(getNewsPageCount('activity'), 6);
  assert.deepEqual(getNewsPageIndices('activity', 7), []);
});

test('expert and knowledge page maps match the stable Wix captures', () => {
  assert.deepEqual(getNewsPageIndices('expert', 1), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(getNewsPageIndices('expert', 2), [9, 10, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual(getNewsPageIndices('expert', 3), [18, 19, 21, 22, 23, 24, 25, 26]);
  assert.deepEqual(getNewsPageIndices('expert', 4), [27, 28, 29, 30, 31, 32, 33]);
  assert.equal(getNewsPageCount('expert'), 4);

  assert.deepEqual(getNewsPageIndices('knowledge', 1), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(getNewsPageIndices('knowledge', 2), [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual(getNewsPageIndices('knowledge', 3), [18, 19, 20, 21, 22, 23, 24, 25, 26]);
  assert.deepEqual(getNewsPageIndices('knowledge', 4), [27, 28, 29, 30, 31, 32]);
  assert.equal(getNewsPageCount('knowledge'), 4);
});


test('responsive news gallery applies card geometry to all card media descendants', () => {
  const cards = Array.from({ length: 9 }, () => {
    const item = { style: {} };
    const imageWrapper = { style: {} };
    const imageContent = { style: {} };
    const image = { style: {} };
    return {
      item,
      imageWrapper,
      imageContent,
      image,
      querySelector(selector) {
        return {
          '[data-hook="item-container"]': item,
          '.gallery-item-wrapper': imageWrapper,
          '.gallery-item-content': imageContent,
          '[data-hook="gallery-item-image-img"]': image,
        }[selector] ?? null;
      },
    };
  });
  const gallery = { parentElement: { clientWidth: 358 }, style: {} };

  applyResponsiveNewsGalleryLayout(gallery, cards, 390);

  assert.equal(gallery.style.width, '358px');
  assert.equal(cards[0].item.style.width, '358px');
  assert.equal(cards[0].item.style.height, '291.375px');
  assert.equal(cards[3].item.style.inset, '934.125px auto auto 0px');
  assert.equal(cards[8].item.style.inset, '2491px auto auto 0px');
  assert.equal(cards[0].imageWrapper.style.height, '201.375px');
  assert.equal(cards[0].imageContent.style.width, '358px');
  assert.equal(cards[0].image.style.height, '201.375px');
});

test('news gallery layout follows the Wix three-column responsive measurements', () => {
  assert.deepEqual(getResponsiveNewsGalleryLayout(390, 358, 9), {
    width: 358,
    columns: 1,
    cardWidth: 358,
    cardHeight: 291.375,
    columnGap: 0,
    rowGap: 20,
    height: 2782.375,
  });
  assert.deepEqual(getResponsiveNewsGalleryLayout(320, 288, 9), {
    width: 288,
    columns: 1,
    cardWidth: 288,
    cardHeight: 252,
    columnGap: 0,
    rowGap: 20,
    height: 2428,
  });
  assert.deepEqual(getResponsiveNewsGalleryLayout(1024, 864, 9), {
    width: 864,
    columns: 3,
    cardWidth: 268,
    cardHeight: 245.75,
    columnGap: 30,
    rowGap: 30,
    height: 797.25,
  });
  assert.equal(getResponsiveNewsGalleryLayout(1440, 1265, 9), null);
});

test('mobile News section preserves the source measured bottom spacing after the one-column cards', () => {
  const page = readFileSync(resolve(PROJECT_ROOT, 'news/index.html'), 'utf8');
  const styles = readFileSync(resolve(PROJECT_ROOT, 'assets/news-mobile-section-parity.css'), 'utf8');

  assert.ok(page.includes('news-mobile-section-parity.css'));
  assert.match(styles, /#comp-m71mbwsq\s*\{[^}]*padding-bottom:\s*9\.4px/);
});

test('desktop News footer matches the measured source height at wide layouts', () => {
  const page = readFileSync(resolve(PROJECT_ROOT, 'news/index.html'), 'utf8');
  const styles = readFileSync(resolve(PROJECT_ROOT, 'assets/news-desktop-section-parity.css'), 'utf8');

  assert.ok(page.includes('news-desktop-section-parity.css'));
  assert.match(
    styles,
    /@media screen and \(min-width: 1360px\)[\s\S]*?#comp-m7j8ncy9_r_comp-m78h3686\s*\{[^}]*min-height:\s*625\.6px/,
  );
});

test('page maps reject invalid requests and remain immutable', () => {
  assert.ok(Object.isFrozen(NEWS_PAGE_INDICES));
  assert.deepEqual(getNewsPageIndices('missing', 1), []);
  assert.deepEqual(getNewsPageIndices('activity', 0), []);
  assert.deepEqual(getNewsPageIndices('activity', 1, 5), []);
});


test('archived page maps stay within captured cards and custom links exist', () => {
  const archives = {
    activity: ['blog/categories/hoạt-động/index.html', 50],
    expert: ['blog/categories/talk-interview/index.html', 34],
    knowledge: ['blog/categories/knowledge/index.html', 33],
  };

  for (const [tab, [relativePath, expectedCount]] of Object.entries(archives)) {
    const html = readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf8');
    const gallery = html.match(/id="pro-gallery-margin-container-pro-blog"[\s\S]*?data-key="items-styles"/)?.[0];
    assert.ok(gallery, `${tab} gallery markup`);
    const actualCount = (gallery.match(/data-hook="item-link-wrapper"/g) ?? []).length;
    assert.equal(actualCount, expectedCount, `${tab} archive count`);
    for (const page of NEWS_PAGE_INDICES[tab]) {
      assert.ok(page.every(index => index < expectedCount + (
        tab === 'activity' ? NEWS_UNARCHIVED_ACTIVITY_ITEMS.length : 0
      )));
    }
  }

  for (const item of NEWS_UNARCHIVED_ACTIVITY_ITEMS) {
    if (!item.href) continue;
    const route = decodeURIComponent(
      new URL(item.href, 'https://local.invalid').pathname
        .replace(/^\/deedee-studio-static\//, ''),
    );
    assert.ok(
      existsSync(resolve(PROJECT_ROOT, route, 'index.html')),
      `expected local detail route for ${item.title}`,
    );
  }
});


test('Asia TV Forum image keeps the source article geometry in a route-scoped stylesheet', () => {
  const page = readFileSync(
    resolve(PROJECT_ROOT, 'post/deedee-attended-asia-tv-forum-market-2019/index.html'),
    'utf8',
  );
  const stylePath = resolve(PROJECT_ROOT, 'assets/asia-tv-forum-article.css');
  const styles = readFileSync(stylePath, 'utf8');

  assert.ok(page.includes('/assets/asia-tv-forum-article.css'));
  assert.match(page, /id="viewer-b3jpc"/);
  assert.match(page, /data-hook="image-viewer-b3jpc"/);
  assert.ok(styles.includes('width: min(740px, 100%)'));
  assert.ok(styles.includes('aspect-ratio: 4 / 3'));
  assert.ok(styles.includes('height: 100%'));
});

test('newly archived Activity cards link to exact captured Vietnamese post routes', () => {
  const restoredHeadings = new Map([
    ['DeeDee x MACC: Master Class With Anime Director Ito Tomohiko (2020)', 'DeeDee x MACC: Master Class With Anime Director Ito Tomohiko (2020)'],
    ['Trip 2020', 'DeeDee Trip (2020)'],
    ['A Visiting From Mr. Frederic Alliod (2020)', 'A Visiting From Mr. Frederic Alliod (2020)'],
    ['A Visiting From Mr. Phạm Quang Vinh - Director Of Kim Dong Publishing House (2020)', 'A Visiting From Mr. Phạm Quang Vinh - Director Of Kim Dong Publishing House (2020)'],
    ['Asia TV Forum 2019', 'DeeDee Attended Asia TV Forum & Market (2019)'],
    ['21st Viet Nam Film Festival 2019', '21st Viet Nam Film Festival (2019)'],
  ]);
  const restored = NEWS_UNARCHIVED_ACTIVITY_ITEMS.filter(item => restoredHeadings.has(item.title));

  assert.equal(restored.length, 6);
  for (const item of restored) {
    assert.ok(item.href, `expected verified local link for ${item.title}`);
    const route = decodeURIComponent(
      new URL(item.href, 'https://local.invalid').pathname
        .replace('/deedee-studio-static/', ''),
    );
    const pagePath = resolve(PROJECT_ROOT, route, 'index.html');
    assert.ok(existsSync(pagePath), `expected archived route for ${item.title}`);
    const html = readFileSync(pagePath, 'utf8');
    assert.match(html, /<article[^>]+data-hook="post"/);
    assert.ok(!html.includes('DeeDee Trip (2022)'), `stale template title in ${item.title}`);
    const expectedHeading = restoredHeadings.get(item.title).replaceAll('&', '&amp;');
    assert.ok(
      html.includes(`data-hook="post-title">${expectedHeading}</h1>`),
      `expected source heading for ${item.title}`,
    );
    const localMedia = html.match(/wix-437529_[^" ,]+/g) ?? [];
    for (const filename of localMedia) {
      assert.ok(existsSync(resolve(PROJECT_ROOT, 'assets', filename)), `missing local article media ${filename}`);
    }
  }
});

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

// English tabs hold their own posts (measured on the live site: 48 / 39 / 33 items in 6 / 5 / 4 pages).
test('English news tabs follow the live page counts and place every item exactly once', () => {
  assert.deepEqual([getNewsPageCount('activity', 'en'), getNewsPageCount('expert', 'en'), getNewsPageCount('knowledge', 'en')], [6, 5, 4]);
  assert.equal(getNewsPageCount('activity'), 6, 'Vietnamese counts are unchanged');
  const expectedItems = { activity: 48, expert: 39, knowledge: 33 };
  for (const [tab, count] of Object.entries(expectedItems)) {
    const all = NEWS_PAGE_INDICES_EN[tab].flat();
    assert.equal(all.length, count, `${tab} items`);
    assert.equal(new Set(all).size, count, `${tab} has no duplicates`);
    const archiveCards = count - (NEWS_UNARCHIVED_ITEMS_EN[tab]?.length ?? 0);
    assert.deepEqual([...all].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i), `${tab} indices are contiguous`);
    assert.ok(archiveCards > 0);
    assert.ok(NEWS_PAGE_INDICES_EN[tab].every(page => page.length <= 9));
  }
  assert.deepEqual(getNewsPageIndices('expert', 1, 39, 'en').slice(0, 2), [38, 0], 'a post missing from the archive leads page 1');
  assert.deepEqual(getNewsPageIndices('activity', 7, 48, 'en'), []);
});

test('news language is taken from the route', () => {
  assert.equal(newsLanguageFor('/deedee-studio-static/en/news/'), 'en');
  assert.equal(newsLanguageFor('/en/news'), 'en');
  assert.equal(newsLanguageFor('/deedee-studio-static/news/'), 'vi');
  assert.equal(newsLanguageFor('/deedee-studio-static/post/pen-and-ink'), 'vi');
  assert.equal(newsLanguageFor(undefined), 'vi');
});

test('the English news page loads the pagination script', async () => {
  const html = await (await import('node:fs/promises')).readFile(new URL('../en/news/index.html', import.meta.url), 'utf8');
  assert.match(html, /scripts\/news-pagination\.mjs/);
});
