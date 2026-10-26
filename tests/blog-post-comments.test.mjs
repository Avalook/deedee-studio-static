import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { installLocalCommentComposer } from '../scripts/local-comment-composer.mjs';

const ROUTE = new URL('../en/post/does-adult-animation-always-look-mature/index.html', import.meta.url);
const CSS = new URL('../assets/blog-comments-local.css', import.meta.url);
const SCRIPT = new URL('../scripts/local-comment-composer.mjs', import.meta.url);

test('adult-animation article restores a source-shaped local comments section before the footer', async () => {
  const html = await readFile(ROUTE, 'utf8');
  const relatedPosts = html.indexOf('data-hook="recent-posts"');
  const comments = html.indexOf('data-hook="wc-root');
  const footer = html.indexOf('id="comp-m8whddmb"');

  assert.ok(relatedPosts >= 0 && relatedPosts < comments && comments < footer, 'comments follow related posts and precede the site footer');
  const css = await readFile(CSS, 'utf8');
  const script = await readFile(SCRIPT, 'utf8');
  assert.match(html, /<h2[^>]*>Comments<\/h2>/);
  assert.match(html, /Write a comment\.\.\./);
  assert.match(html, /blog-comments-local\.css/);
  assert.match(html, /local-comment-composer\.mjs/);
  assert.match(html, /class="L5x0Fp xZVb1s is-desktop app-desktop" data-deedee-mobile-app-parity="adult-animation"/);
  assert.equal([...html.matchAll(/data-deedee-mobile-app-parity="adult-animation"/g)].length, 1);
  assert.match(css, /margin:\s*30px auto 0/);
  assert.match(css, /padding:\s*32px 18px/);
  assert.match(css, /min-height:\s*143px/);
  const commentsMarkup = html.slice(comments, footer);
  assert.match(commentsMarkup, /to post a comment/);
  assert.match(commentsMarkup, /data-comment-login[^>]*disabled/);
  assert.match(commentsMarkup, /data-comment-publish[^>]*disabled/);
  for (const tool of ['Add emoji', 'Add image', 'Add GIF', 'Add video']) {
    assert.ok(commentsMarkup.includes(`aria-label="${tool}"`), `keeps Wix's ${tool} control visible in the composer`);
  }
  assert.doesNotMatch(commentsMarkup, /Save draft|This static site cannot publish comments/i);
  assert.doesNotMatch(script, /localStorage|fetch\(|XMLHttpRequest/i, 'the local composer does not fake persistence or comment publishing');
  assert.match(css, /data-deedee-mobile-app-parity="adult-animation"[^}]*\.ZL4A4N\s*\{[^}]*padding-top:\s*0\s*!important/s);
  assert.match(css, /data-deedee-mobile-app-parity="adult-animation"[^}]*article\.tgMH9T\s*\{[^}]*font-size:\s*16px\s*!important;[^}]*line-height:\s*22px\s*!important/s);
  assert.match(css, /data-deedee-mobile-app-parity="adult-animation"[^}]*article\.tgMH9T \[data-ricos-paragraph\]\s*\{[^}]*font-size:\s*16px\s*!important/s);
});

test('Vietnamese collaboration article keeps the hydrated Wix comments form and stacks one related card at 744px', async () => {
  const html = await readFile(
    new URL('../post/chia-khoa-cho-mot-quy-trinh-hop-tac-quoc-te/index.html', import.meta.url),
    'utf8',
  );
  const parityCss = await readFile(
    new URL('../assets/international-collaboration-post-mobile-parity.css', import.meta.url),
    'utf8',
  );
  const articleParityCss = await readFile(
    new URL('../assets/article-comment-parity.css', import.meta.url),
    'utf8',
  );
  const commentsCss = await readFile(
    new URL('../assets/blog-comments-local.css', import.meta.url),
    'utf8',
  );

  assert.match(html, /data-hook="wc-root 6ab5faeb1b9782ba8f192d50"/);
  assert.match(html, />Bình luận<\/h2>/);
  assert.match(html, /data-hook="comment-box-placeholder-text">Viết bình luận\.\.\.<\/span>/);
  assert.match(html, /data-deedee-local-comments/);
  assert.match(html, /data-comment-open/);
  assert.match(html, /data-comment-editor[^>]*contenteditable="true"/);
  assert.match(html, /data-comment-cancel/);
  assert.match(html, /data-comment-publish[^>]*disabled/);
  assert.match(html, /assets\/blog-comments-local\.css/);
  assert.match(html, /scripts\/local-comment-composer\.mjs/);
  assert.match(commentsCss, /\[data-deedee-local-comments\]\s+\[hidden\][^{]*\{\s*display:\s*none\s*!important/s);
  assert.doesNotMatch(html, /href="[^"]*article-comment-parity\.css"/);
  assert.doesNotMatch(parityCss, /section\.prZ8Wc\s*\{\s*display:\s*none\s*!important;/);
  assert.match(articleParityCss, /display:\s*none\s*!important/);
  assert.match(parityCss, /@media\s*\(min-width:\s*601px\)\s*and\s*\(max-width:\s*746px\)/);
  assert.match(parityCss, /recent-post-list-item/);
  assert.match(parityCss, /recent-post-list-item[^}]*max-width:\s*100%\s*!important/s);
  assert.match(parityCss, /section\.prZ8Wc[^}]*padding-top:\s*0\s*!important/s);
  assert.match(parityCss, /section\.prZ8Wc[^}]*padding-bottom:\s*30px\s*!important/s);
  assert.match(parityCss, /section\.prZ8Wc[^}]*padding-left:\s*0\s*!important/s);
  assert.match(parityCss, /section\.prZ8Wc[^}]*padding-right:\s*0\s*!important/s);
});

test('comment composer opens an editor and cancel closes it without publishing', () => {
  const controls = new Map();
  const makeControl = (hidden = false) => {
    const listeners = new Map();
    const attributes = new Map();
    return {
      hidden,
      textContent: '',
      focused: false,
      addEventListener(type, handler) { listeners.set(type, handler); },
      removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
      setAttribute(name, value) { attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      focus() { this.focused = true; },
      click() { listeners.get('click')?.({ preventDefault() {} }); },
    };
  };
  const openButton = makeControl();
  const composer = makeControl(true);
  const editor = makeControl();
  const cancelButton = makeControl();
  controls.set('[data-comment-open]', openButton);
  controls.set('[data-comment-composer]', composer);
  controls.set('[data-comment-editor]', editor);
  controls.set('[data-comment-cancel]', cancelButton);
  const root = { querySelector: (selector) => controls.get(selector) };

  const cleanup = installLocalCommentComposer(root);
  openButton.click();
  assert.equal(composer.hidden, false);
  assert.equal(editor.focused, true);
  assert.equal(openButton.getAttribute('aria-expanded'), 'true');
  editor.textContent = 'Unpublished local text';
  cancelButton.click();
  assert.equal(composer.hidden, true);
  assert.equal(openButton.hidden, false);
  assert.equal(openButton.getAttribute('aria-expanded'), 'false');
  assert.equal(editor.textContent, '');
  cleanup();
});


test('Vietnamese post family restores measured source mobile geometry without unsupported comments controls', async () => {
  const routes = [
    new URL('../post/website-cho-animator/index.html', import.meta.url),
    new URL('../post/12-nguyên-tắc-animation-nguyên-tắc-6-slow-in-slow-out/index.html', import.meta.url),
    new URL('../post/cafe-sáng-vtv3-deedee-animation-studio-và-hành-trình-kể-chuyện-lịch-sử-bằng-hoạt-hình/index.html', import.meta.url),
  ];
  const parityCss = await readFile(new URL('../assets/article-comment-parity.css', import.meta.url), 'utf8');
  for (const route of routes) {
    const html = await readFile(route, 'utf8');
    assert.match(html, /data-deedee-post-mobile-parity/);
    assert.match(html, /assets\/article-comment-parity\.css/);
    // Every article now carries live's comments section (scripts/add-post-comments.mjs).
    assert.match(html, /data-deedee-local-comments/);
  }

  assert.match(parityCss, /^\.L5x0Fp \[data-hook\^="wc-root"\]\.wc-comments-root:not\(\[data-deedee-local-comments\]\) \{\s*display:\s*none\s*!important;\s*\}/m, 'stale Wix comment roots are hidden only inside blog article content, never the restored section');
  assert.doesNotMatch(parityCss, /^\[data-hook\^="wc-root"\]\.wc-comments-root/m, 'the suppression must not leak to comment roots outside articles');
  assert.match(parityCss, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.L5x0Fp\[data-deedee-post-mobile-parity\]\s+section\.prZ8Wc:has\(\.wc-comments-root\)\s*\{\s*display:\s*block\s*!important;/s, 'measured mobile-parity posts keep their comments shell visible on phone widths');
  assert.match(parityCss, /\.L5x0Fp\[data-deedee-post-mobile-parity\] section\.prZ8Wc \.wc-comments-root:not\(\[data-deedee-local-comments\]\) > \.uh2d5F/);
  assert.match(parityCss, /\.L5x0Fp\[data-deedee-post-mobile-parity\]\s*\{[^}]*padding:\s*0 0 0/s);
  assert.match(parityCss, /\.ZL4A4N[^}]*padding-top:\s*0\s*!important/s);
  assert.match(parityCss, /article\.tgMH9T h1\.H3vOVf[^}]*font-size:\s*26px\s*!important/s);
  assert.match(parityCss, /article\.tgMH9T \[data-ricos-paragraph\][^}]*font-size:\s*16px\s*!important/s);
  assert.match(parityCss, /article\.tgMH9T h2[^}]*font-size:\s*24px\s*!important/s);
  assert.match(parityCss, /data-deedee-post-mobile-parity="cafe-vtv3"[^}]*data-ricos-paragraph[^}]*line-height:\s*24px\s*!important/s);
  assert.match(parityCss, /data-deedee-post-mobile-parity="cafe-vtv3"[^}]*figure\.oH3fR figcaption[^}]*font-size:\s*14px\s*!important/s);
  assert.match(parityCss, /data-deedee-post-mobile-parity="cafe-vtv3"[^}]*figure\.oH3fR figcaption[^}]*line-height:\s*24px\s*!important/s);
  const websiteLineHeightIds = ['8j4d9', 'fde4v', '2n387', 'e9a3', '6s28v', 'ej25g', '1h2en', '7f2un', 'cpe5p', '8ai84', '6jt9h', '2ii9f', 'h3d0', 'dpdfm', '5oe30', 'cqffb', 'ddd36', 'eieg5', 'asvqn'];
  const slowLineHeightIds = ['f3kl4', 'cu79u', '1csq8', '3gm7l', 'd6fg2', 'canak', 'donpd', '707gb', '877s7', 'cj1cs', '26di', 'cne4n', '273ko'];
  for (const id of websiteLineHeightIds) assert.ok(parityCss.includes(`data-deedee-post-mobile-parity="website-animator"] #viewer-${id}`));
  for (const id of slowLineHeightIds) assert.ok(parityCss.includes(`data-deedee-post-mobile-parity="slow-in-slow-out"] #viewer-${id}`));
  assert.match(parityCss, /#viewer-8j4d9[\s\S]*?line-height:\s*24px\s*!important;/);
  assert.match(parityCss, /#viewer-f3kl4[\s\S]*?line-height:\s*24px\s*!important;/);
  assert.ok(parityCss.includes('[data-hook="recent-post-list-item"]:nth-of-type(n + 2) {\n    display: none !important;'));
  assert.match(parityCss, /data-deedee-post-mobile-parity[^}]*footer[^}]*height:\s*108px\s*!important/s);
  assert.match(parityCss, /data-deedee-post-mobile-parity[^}]*wc-comments-root[^}]*display:\s*block\s*!important/s);
});

test('unhydrated Wix comments shells do not leave blank space before article footers', async () => {
  const routes = [
    new URL('../post/sunny-side-down-series-youtube-chất-lượng-cao/index.html', import.meta.url),
    new URL('../post/bên-trong-quy-trình-sản-xuất-hoạt-hình-trọn-gói-của-deedee/index.html', import.meta.url),
  ];
  const parityCss = await readFile(new URL('../assets/article-comment-parity.css', import.meta.url), 'utf8');

  for (const route of routes) {
    const html = await readFile(route, 'utf8');
    assert.match(html, /class="prZ8Wc"/);
    assert.match(html, /wc-comments-root/);
    assert.match(html, /article-comment-parity\.css/);
  }
  assert.match(parityCss, /\.L5x0Fp\s+section\.prZ8Wc:has\(\.wc-comments-root:not\(\[data-deedee-local-comments\]\)\)\s*\{\s*display:\s*none\s*!important;/s);

  const sunnyArticle = await readFile(
    new URL('../post/sunny-side-down-series-youtube-chất-lượng-cao/index.html', import.meta.url),
    'utf8',
  );
  assert.match(sunnyArticle, /class="L5x0Fp xZVb1s is-desktop app-desktop" data-deedee-comments-desktop="sunny-series"/);
  assert.equal([...sunnyArticle.matchAll(/data-deedee-comments-desktop="sunny-series"/g)].length, 1);
  assert.match(sunnyArticle, /data-render="SSR_LOADED"[\s\S]*?data-hook="top-level-comment-list"/);
  assert.match(parityCss, /@media\s*\(min-width:\s*1024px\)\s*and\s*\(max-width:\s*1024px\)[\s\S]*?data-deedee-comments-desktop="sunny-series"[^}]*section\.prZ8Wc:has\(\.wc-comments-root\)[^}]*display:\s*block\s*!important/s);
  assert.match(parityCss, /data-deedee-comments-desktop="sunny-series"[^}]*section\.prZ8Wc \.wc-comments-root[^}]*display:\s*block\s*!important/s);

  const collaboration = await readFile(
    new URL('../post/chia-khoa-cho-mot-quy-trinh-hop-tac-quoc-te/index.html', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(collaboration, /article-comment-parity\.css/);
  assert.match(collaboration, /data-deedee-local-comments/);
});

test('archived blog articles restore the mobile app width and paragraph scale', async () => {
  const routes = [
    new URL('../en/post/sunny-side-down-crafting-expressive-animation-in-a-cosmic-chaos/index.html', import.meta.url),
    new URL('../post/sunny-side-down-series-youtube-chất-lượng-cao/index.html', import.meta.url),
  ];
  const parityCss = await readFile(new URL('../assets/article-comment-parity.css', import.meta.url), 'utf8');

  for (const route of routes) {
    const html = await readFile(route, 'utf8');
    assert.match(html, /class="L5x0Fp xZVb1s is-desktop app-desktop"/);
    assert.match(html, /article-comment-parity\.css/);
  }
  assert.match(parityCss, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.L5x0Fp\.xZVb1s\.is-desktop\.app-desktop:not\(\[data-deedee-post-mobile-parity\]\)\s*\{[^}]*padding-left:\s*0\s*!important;[^}]*padding-right:\s*0\s*!important;[^}]*--textParagraphFont-size:\s*16px/s);
  assert.match(parityCss, /\.L5x0Fp\.xZVb1s\.is-desktop\.app-desktop:not\(\[data-deedee-post-mobile-parity\]\) #content-wrapper article\.tgMH9T\s*\{[^}]*font-size:\s*16px\s*!important;[^}]*line-height:\s*22px\s*!important/s);
  assert.match(parityCss, /\.L5x0Fp\.xZVb1s\.is-desktop\.app-desktop:not\(\[data-deedee-post-mobile-parity\]\) #content-wrapper article\.tgMH9T \[data-ricos-paragraph\]\s*\{[^}]*font-size:\s*16px\s*!important/s);

  const localCommentsCss = await readFile(new URL('../assets/blog-comments-local.css', import.meta.url), 'utf8');
  assert.match(localCommentsCss, /@media\s*\(max-width:\s*600px\)[\s\S]*?\.L5x0Fp\.xZVb1s\.is-desktop\.app-desktop\s*\{[^}]*padding-left:\s*0\s*!important;[^}]*padding-right:\s*0\s*!important;/s);
});
