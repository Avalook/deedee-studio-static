import assert from 'node:assert/strict';
import test from 'node:test';
import { addPostComments } from '../scripts/add-post-comments.mjs';

const parts = {
  id: 'a'.repeat(24),
  block: '<div><section class="prZ8Wc"><div data-hook="wc-root ' + 'a'.repeat(24) + '" data-deedee-local-comments><h2>Bình luận</h2><button>Viết bình luận...</button></div></section></div>',
  links: ['<link rel="stylesheet" href="/x/blog-comments-local.css">'],
};
const RELATED = '</article></div></section></section></div></div>';
const page = tail => `<html><head></head><body><main>${RELATED}${tail}</main></body></html>`;

test('the comments section is inserted after the related posts, with its stylesheet and script', () => {
  const html = addPostComments(page(''), parts, 'post/a');
  assert.ok(html.indexOf(RELATED) < html.indexOf('data-deedee-local-comments'));
  assert.ok(html.includes('<h2>Bình luận</h2>'));
  assert.ok(html.includes('blog-comments-local.css'));
  assert.ok(html.includes('local-comment-composer.mjs'));
  assert.ok(!html.includes('a'.repeat(24)), 'each page gets its own comment root id');
});

test('English pages get live’s English wording', () => {
  const html = addPostComments(page(''), parts, 'en/post/a', 'en');
  assert.ok(html.includes('<h2>Comments</h2>') && html.includes('Write a comment...'));
  assert.ok(!html.includes('Bình luận'));
});

test('an empty Wix shell is replaced rather than duplicated, and a second run changes nothing', () => {
  const shell = '<div><section class="prZ8Wc"><section data-hook="wc-root zz"><b>empty</b></section></section></div>';
  const once = addPostComments(page(shell), parts, 'post/a');
  assert.ok(!once.includes('empty') && once.includes('data-deedee-local-comments'));
  assert.equal([...once.matchAll(/prZ8Wc/g)].length, 1);
  assert.equal(addPostComments(once, parts, 'post/a'), once);
});

test('a page with no related-posts anchor and no shell is reported, not guessed', () => {
  assert.equal(addPostComments('<html><head></head><body><main>x</main></body></html>', parts, 'post/a'), null);
});
