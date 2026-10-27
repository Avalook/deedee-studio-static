import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { buildComment, fetchApprovedComments, installCommentSubmit, isCommentsConfigured, postPathFor, validateComment } from '../scripts/comment-submit.mjs';
import { resetFormConfigCache } from '../scripts/form-submit.mjs';

const KEY = 'sb_publishable_abcdefghijklmnopqrstuvwxyz0123';
const CONFIG = { url: 'https://abcdefgh.supabase.co', publishableKey: KEY, table: 'form_submissions' };
const MARKUP = `<html lang="vi"><head></head><body><div class="wc-comments-root" data-deedee-local-comments>
  <div data-comment-composer hidden><div data-comment-editor contenteditable="true"></div>
    <div class="deedee-local-comments__auth-boundary"><button data-comment-login disabled>Đăng nhập</button></div>
    <button data-comment-cancel>Hủy</button><button data-comment-publish disabled>Đăng</button></div>
  <div data-hook="top-level-comment-list"><div class="NiA1Ty"></div></div></div></body></html>`;

function setup({ config = CONFIG, approved = [], postStatus = 201, readStatus = 200 } = {}) {
  resetFormConfigCache();
  const { window, document } = parseHTML(MARKUP);
  const calls = [];
  const store = new Map();
  const win = { location: { pathname: '/deedee-studio-static/post/bai-moi/' }, localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('supabase-config.json')) return { ok: Boolean(config), json: async () => config };
    if (options.method === 'POST') return { ok: postStatus < 300, status: postStatus };
    return { ok: readStatus < 300, status: readStatus, json: async () => approved };
  };
  return { window, document, win, fetchImpl, calls, root: document.querySelector('[data-deedee-local-comments]') };
}
const click = (window, element) => element.dispatchEvent(new window.Event('click', { bubbles: true }));
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test('post path, validation and the row sent to Supabase', () => {
  assert.equal(postPathFor('/deedee-studio-static/post/abc/'), '/post/abc');
  assert.equal(postPathFor('/en/post/abc'), '/en/post/abc');
  assert.equal(postPathFor('/deedee-studio-static'), '/');
  assert.equal(validateComment({ name: ' ', body: 'x' }), 'nameRequired');
  assert.equal(validateComment({ name: 'An', body: '  ' }), 'bodyRequired');
  assert.equal(validateComment({ name: 'An', body: 'x'.repeat(2001) }), 'tooLong');
  assert.equal(validateComment({ name: 'An', body: 'hi' }), null);
  const row = buildComment({ name: '  An \u0007  Nguyen ', body: 'Xin\u0000 chào', pathname: '/deedee-studio-static/post/abc/', language: 'fr' });
  assert.deepEqual(row, { post_path: '/post/abc', language: 'vi', author_name: 'An Nguyen', body: 'Xin chào' });
  assert.equal(isCommentsConfigured(CONFIG), true);
  assert.equal(isCommentsConfigured({ ...CONFIG, url: 'http://evil.test' }), false);
  assert.equal(isCommentsConfigured({ ...CONFIG, commentsTable: 'x; drop table' }), false);
  assert.equal(isCommentsConfigured(null), false);
});

test('without Supabase configuration the comment box stays as it was', async () => {
  const { root, window, win, fetchImpl, document } = setup({ config: null });
  assert.equal(await installCommentSubmit(root, document, win, fetchImpl), false);
  assert.ok(root.querySelector('[data-comment-publish]').hasAttribute('disabled'));
  assert.equal(root.querySelector('[data-comment-name]'), null);
});

test('approved comments render as plain text; a visitor comment is sent as pending', async () => {
  const hostile = { author_name: '<img src=x onerror=alert(1)>', body: '<script>alert(1)</script>\nline two', created_at: '2026-10-01T00:00:00Z' };
  const { root, window, win, fetchImpl, document, calls } = setup({ approved: [hostile, { author_name: 'Linh', body: 'Hay quá', created_at: '2026-10-02T00:00:00Z' }] });
  assert.equal(await installCommentSubmit(root, document, win, fetchImpl), true);
  await tick();
  const list = root.querySelector('.NiA1Ty');
  assert.equal(list.querySelectorAll('.deedee-local-comments__item').length, 2);
  assert.equal(list.querySelector('img, script'), null, 'visitor text is never parsed as HTML');
  assert.match(list.textContent, /<img src=x onerror=alert\(1\)>/);
  const get = calls.find((call) => call.url.includes('/rest/v1/comments?'));
  assert.match(get.url, /post_path=eq\.%2Fpost%2Fbai-moi/);
  assert.equal(get.options.headers.apikey, KEY);

  const publish = root.querySelector('[data-comment-publish]');
  assert.equal(publish.hasAttribute('disabled'), false);
  assert.equal(root.querySelector('.deedee-local-comments__auth-boundary').hasAttribute('hidden'), true);
  const status = root.querySelector('.deedee-local-comments__status');
  click(window, publish); await tick();
  assert.match(status.textContent, /nhập tên/);
  root.querySelector('[data-comment-name]').value = 'Minh';
  click(window, publish); await tick();
  assert.match(status.textContent, /nhập nội dung/);
  root.querySelector('[data-comment-editor]').textContent = 'Bài viết rất hữu ích';
  click(window, publish); await tick(); await tick();
  const post = calls.find((call) => call.options.method === 'POST');
  assert.equal(post.url, 'https://abcdefgh.supabase.co/rest/v1/comments');
  assert.deepEqual(JSON.parse(post.options.body), { post_path: '/post/bai-moi', language: 'vi', author_name: 'Minh', body: 'Bài viết rất hữu ích' });
  assert.equal(post.options.headers.Prefer, 'return=minimal');
  assert.match(status.textContent, /duyệt/);
  assert.equal(root.querySelector('[data-comment-editor]').textContent, '');
  root.querySelector('[data-comment-editor]').textContent = 'Gửi liền tay';
  click(window, publish); await tick();
  assert.match(status.textContent, /đợi vài giây/);
  assert.equal(calls.filter((call) => call.options.method === 'POST').length, 1, 'cooldown blocks a second post');
});

test('a failed insert and a honeypot hit', async () => {
  const failing = setup({ postStatus: 429 });
  await installCommentSubmit(failing.root, failing.document, failing.win, failing.fetchImpl);
  failing.root.querySelector('[data-comment-name]').value = 'A'; failing.root.querySelector('[data-comment-editor]').textContent = 'B';
  click(failing.window, failing.root.querySelector('[data-comment-publish]')); await tick(); await tick();
  assert.match(failing.root.querySelector('.deedee-local-comments__status').textContent, /Không gửi được/);
  const bot = setup();
  await installCommentSubmit(bot.root, bot.document, bot.win, bot.fetchImpl);
  bot.root.querySelector('[data-comment-name]').value = 'Bot'; bot.root.querySelector('[data-comment-editor]').textContent = 'spam';
  bot.root.querySelector('[data-deedee-comment-honeypot]').value = 'http://spam';
  click(bot.window, bot.root.querySelector('[data-comment-publish]')); await tick();
  assert.equal(bot.calls.some((call) => call.options.method === 'POST'), false);
  assert.equal(await fetchApprovedComments(null, '/x', async () => { throw new Error('no'); }), null);
  assert.equal(await fetchApprovedComments(CONFIG, '/x', async () => { throw new Error('offline'); }), null);
});

test('until the comments table exists the box is left untouched', async () => {
  const { root, win, fetchImpl, document } = setup({ readStatus: 404 });
  assert.equal(await installCommentSubmit(root, document, win, fetchImpl), false);
  assert.ok(root.querySelector('[data-comment-publish]').hasAttribute('disabled'));
  assert.equal(root.querySelector('[data-comment-name]'), null);
  assert.equal(root.querySelector('.deedee-local-comments__auth-boundary').hasAttribute('hidden'), false);
});
