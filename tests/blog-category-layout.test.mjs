import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile category navigation keeps the current category inline and moves remaining links under Khác', async () => {
  const script = await readFile(new URL('../scripts/progressive-blog-feed.mjs', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../assets/blog-category-grid.css', import.meta.url), 'utf8');
  const archive = await readFile(new URL('../blog/categories/hoạt-động/index.html', import.meta.url), 'utf8');
  const navStart = archive.lastIndexOf('<nav', archive.indexOf('aria-label="Blog"'));
  const nav = archive.slice(navStart, archive.indexOf('</nav>', navStart) + 6);

  assert.ok(nav, 'the original blog category navigation is retained');
  for (const label of ['All Posts', 'Hoạt động', 'Góc chuyên gia', 'Kiến thức']) {
    assert.ok(nav.includes('>' + label + '</a>'), 'category navigation includes ' + label);
  }
  assert.ok(script.includes("button.addEventListener('pointerdown', toggleMenuFromPointer)"));
  assert.ok(script.includes('if (pointerActivationPending) return;'));
  assert.ok(script.includes("button.addEventListener('mousedown', toggleMenuFromPointer)"));
  assert.ok(script.includes('data-deedee-mobile-blog-category-overflow'));
  assert.ok(layout.includes('post-list-pro-gallery-container') && layout.includes('margin: 20px !important;'));
  assert.ok(layout.includes('nav.blog-header__navigation'));
  assert.ok(layout.includes('overflow: visible !important;'));
  assert.ok(layout.includes('z-index: 1000 !important;'));
});

test('all category routes preserve archived posts, source grid geometry, and navigation', async () => {
  const routes = [
    '../blog/categories/hoạt-động/index.html',
    '../blog/categories/talk-interview/index.html',
    '../blog/categories/knowledge/index.html',
  ];
  const pages = await Promise.all(routes.map((route) => readFile(new URL(route, import.meta.url), 'utf8')));

  for (const html of pages) {
    assert.ok(html.includes('data-hook="post-list-pro-gallery-container"'));
    assert.ok(html.includes('id="pro-gallery-margin-container-pro-blog"'));
    assert.ok(html.includes('aria-label="Blog"'));
    assert.ok(html.split('data-hook="item-link-wrapper"').length > 5);
  }
});

test('animation tag feed loads the Wix responsive feed stylesheet', async () => {
  const html = await readFile(new URL('../blog/tags/animation/index.html', import.meta.url), 'utf8');

  assert.ok(html.includes('assets/blog-category-grid.css'));
  assert.ok(html.includes('assets/mobile-menu-parity.css'));
});

test('homepage mobile news cards keep Wix three-column geometry', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../assets/homepage-news-section-parity.css', import.meta.url), 'utf8');

  assert.ok(html.includes('assets/homepage-news-section-parity.css'));
  assert.ok(html.includes('--layout-mobile-post-list-pg-grid-layoutPostsPerRow: 3'));
  assert.ok(styles.includes('max-width: 750px'));
});

test('mobile hero keeps Wix captured scrollbar scale token', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.ok(html.includes('<body class="responsive use-media-queries" style="--scrollbar-width: 15px;">'));
});

test('category grid follows the live breakpoints: 1, 2, 3 and 4 columns with a 32px gap', async () => {
  const css = await readFile(new URL('../assets/blog-category-grid.css', import.meta.url), 'utf8');

  assert.match(css, /@media \(min-width: 1296px\)[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 1800px\)[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(min-width: 700px\) and \(max-width: 1295px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 699px\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.doesNotMatch(css, /minmax\(0, 400px\)/);
  // The card is floored to a whole pixel like live, so 14 rows do not drift.
  assert.ok(css.includes('round(down, calc((100cqw - 64px) / 3), 1px)'));
});

test('every one of the 50 archived cards carries its title, meta and stats', async () => {
  const html = await readFile(new URL('../blog/categories/hoạt-động/index.html', import.meta.url), 'utf8');
  const cards = html.split('data-hook="item-link-wrapper"').slice(1);

  assert.equal(cards.length, 50);
  for (const [index, card] of cards.entries()) {
    assert.ok(card.includes('data-hook="post-title"'), 'card ' + index + ' has a title');
    assert.ok(card.includes('data-hook="view-count-compact"'), 'card ' + index + ' has a view count');
    assert.ok(card.includes('data-hook="comment-count-compact"'), 'card ' + index + ' has a comment count');
  }
});
