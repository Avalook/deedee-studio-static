import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const articleUrl = new URL('../post/chia-khoa-cho-mot-quy-trinh-hop-tac-quoc-te/index.html', import.meta.url);
const cssUrl = new URL('../assets/article-comment-parity.css', import.meta.url);

test('Vietnamese article shows the captured Wix comments form with a local composer fallback', () => {
  const article = readFileSync(articleUrl, 'utf8');
  const stylesheet = readFileSync(cssUrl, 'utf8');

  assert.ok(!article.includes('article-comment-parity.css'));
  assert.ok(article.includes('data-hook="wc-root 6ab5faeb1b9782ba8f192d50"'));
  assert.ok(article.includes('wc-comments-root'));
  assert.ok(article.includes('data-deedee-local-comments'));
  assert.ok(article.includes('data-hook="image-viewer"'));
  assert.ok(article.includes('Chìa khóa cho một quy trình hợp tác quốc tế'));
  assert.ok(article.includes('data-comment-open'));
  assert.ok(article.includes('data-comment-editor'));
  assert.ok(article.includes('blog-comments-local.css'));
  assert.ok(article.includes('local-comment-composer.mjs'));
  assert.ok(stylesheet.includes('[data-hook^="wc-root"].wc-comments-root'));
  assert.ok(stylesheet.includes('display: none !important'));
});
