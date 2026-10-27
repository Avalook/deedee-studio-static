/**
 * Guest comments under articles, stored in Supabase.
 *
 * Like the contact forms, the browser talks to Supabase's REST API with the public key. Row Level Security
 * (docs/supabase-comments-schema.sql) lets visitors INSERT a pending comment and SELECT only approved ones,
 * so every comment waits for approval in the CMS before anyone else sees it.
 */
import { loadFormConfig, publicFormKey } from './form-submit.mjs';

const BASE_PATH = '/deedee-studio-static';
const SUPABASE_URL = /^https:\/\/[a-z0-9-]{3,63}\.supabase\.co$/;
const COOLDOWN_MS = 30_000;
export const MAX_NAME = 80;
export const MAX_BODY = 2000;

const TEXT = {
  vi: {
    name: 'Tên của bạn', nameRequired: 'Vui lòng nhập tên của bạn.', bodyRequired: 'Vui lòng nhập nội dung bình luận.',
    tooLong: 'Bình luận quá dài (tối đa 2000 ký tự).', sending: 'Đang gửi…',
    sent: 'Cảm ơn bạn! Bình luận sẽ hiện sau khi được DeeDee duyệt.', failed: 'Không gửi được bình luận. Vui lòng thử lại sau.',
    wait: 'Bạn vừa gửi một bình luận, vui lòng đợi vài giây.', post: 'Đăng',
  },
  en: {
    name: 'Your name', nameRequired: 'Please enter your name.', bodyRequired: 'Please write a comment.',
    tooLong: 'Your comment is too long (2000 characters at most).', sending: 'Sending…',
    sent: 'Thank you! Your comment will appear after DeeDee approves it.', failed: 'Could not send your comment. Please try again later.',
    wait: 'You just sent a comment, please wait a few seconds.', post: 'Post',
  },
};
export const commentMessages = (language) => TEXT[language === 'en' ? 'en' : 'vi'];

const clean = (value) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();

/** The article route without the GitHub Pages prefix or a trailing slash, e.g. /post/my-article. */
export function postPathFor(pathname) {
  let path = String(pathname ?? '/');
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length) || '/';
  path = path.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  return (path || '/').slice(0, 300);
}

/** Return the first error key, or null when the comment can be sent. */
export function validateComment({ name, body }) {
  if (!clean(name)) return 'nameRequired';
  if (!clean(body)) return 'bodyRequired';
  if (clean(body).length > MAX_BODY) return 'tooLong';
  return null;
}

export function buildComment({ name, body, pathname, language }) {
  return {
    post_path: postPathFor(pathname),
    language: language === 'en' ? 'en' : 'vi',
    author_name: clean(name).replace(/\s+/g, ' ').slice(0, MAX_NAME),
    body: clean(body).slice(0, MAX_BODY),
  };
}

export function isCommentsConfigured(config) {
  return Boolean(config && SUPABASE_URL.test(String(config.url ?? ''))
    && /^[a-z][a-z0-9_]{0,62}$/.test(config.commentsTable || 'comments') && publicFormKey(config));
}

function headers(config, extra = {}) {
  const key = publicFormKey(config);
  return { apikey: key, ...(key.startsWith('sb_publishable_') ? {} : { Authorization: `Bearer ${key}` }), ...extra };
}

export async function submitComment(config, row, fetchImpl = globalThis.fetch) {
  if (!isCommentsConfigured(config)) throw new Error('Comments are not configured');
  const response = await fetchImpl(`${config.url}/rest/v1/${config.commentsTable || 'comments'}`, {
    method: 'POST',
    headers: headers(config, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Supabase answered ${response.status}`);
}

/** Approved comments for an article, or null when the table cannot be read (not created yet, offline). */
export async function fetchApprovedComments(config, postPath, fetchImpl = globalThis.fetch) {
  if (!isCommentsConfigured(config)) return null;
  const query = `post_path=eq.${encodeURIComponent(postPath)}&select=author_name,body,created_at&order=created_at.asc&limit=200`;
  try {
    const response = await fetchImpl(`${config.url}/rest/v1/${config.commentsTable || 'comments'}?${query}`, {
      headers: headers(config), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row.author_name === 'string' && typeof row.body === 'string') : null;
  } catch { return null; }
}

const STYLE = `
.deedee-local-comments__name{display:block;width:100%;box-sizing:border-box;margin:0 0 10px;padding:10px 12px;border:1px solid rgba(0,0,0,.25);border-radius:6px;font:inherit;background:transparent;color:inherit}
.deedee-local-comments__status{margin:10px 0 0;font-size:14px}
.deedee-local-comments__status[data-kind="error"]{color:#c0102f}
.deedee-local-comments__item{padding:14px 0;border-top:1px solid rgba(0,0,0,.12)}
.deedee-local-comments__author{font-weight:700}
.deedee-local-comments__date{margin-left:8px;font-size:12px;opacity:.65}
.deedee-local-comments__text{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}`;

/** Build comment nodes with textContent only, so visitor text can never become markup. */
export function renderComments(container, comments, doc, language = 'vi') {
  if (!container) return;
  container.replaceChildren();
  for (const comment of comments) {
    const item = doc.createElement('div'); item.className = 'deedee-local-comments__item';
    const head = doc.createElement('div');
    const author = doc.createElement('span'); author.className = 'deedee-local-comments__author'; author.textContent = comment.author_name;
    head.appendChild(author);
    const when = new Date(comment.created_at);
    if (!Number.isNaN(when.getTime())) {
      const date = doc.createElement('span'); date.className = 'deedee-local-comments__date';
      date.textContent = when.toLocaleDateString(language === 'en' ? 'en-GB' : 'vi-VN');
      head.appendChild(date);
    }
    const text = doc.createElement('p'); text.className = 'deedee-local-comments__text'; text.textContent = comment.body;
    item.append(head, text);
    container.appendChild(item);
  }
}

const readEditor = (editor) => (typeof editor.innerText === 'string' ? editor.innerText : editor.textContent) || '';

/** Turn the article's inert comment box into a working one once Supabase is configured. */
export async function installCommentSubmit(root, doc = globalThis.document, win = globalThis.window, fetchImpl = globalThis.fetch) {
  const editor = root?.querySelector('[data-comment-editor]');
  const publish = root?.querySelector('[data-comment-publish]');
  const composer = root?.querySelector('[data-comment-composer]');
  if (!editor || !publish || !composer || publish.dataset.deedeeCommentsReady) return false;
  const base = win.location.pathname === BASE_PATH || win.location.pathname.startsWith(`${BASE_PATH}/`) ? BASE_PATH : '';
  const language = doc.documentElement?.lang === 'en' ? 'en' : 'vi';
  const text = commentMessages(language);
  const config = await loadFormConfig(base, fetchImpl);
  if (!isCommentsConfigured(config)) return false;
  // Probe first: until the comments table exists the box stays exactly as it was (no Post button that would fail).
  const path = postPathFor(win.location.pathname);
  const existing = await fetchApprovedComments(config, path, fetchImpl);
  if (existing === null) return false;
  publish.dataset.deedeeCommentsReady = 'true';

  if (!doc.querySelector('style[data-deedee-comments]')) {
    const style = doc.createElement('style'); style.setAttribute('data-deedee-comments', ''); style.textContent = STYLE; doc.head.appendChild(style);
  }
  root.querySelector('.deedee-local-comments__auth-boundary')?.setAttribute('hidden', '');
  const name = doc.createElement('input');
  Object.assign(name, { type: 'text', maxLength: MAX_NAME, placeholder: text.name });
  name.className = 'deedee-local-comments__name'; name.setAttribute('autocomplete', 'name'); name.setAttribute('aria-label', text.name);
  name.setAttribute('data-comment-name', '');
  composer.insertBefore(name, composer.firstChild);
  const trap = doc.createElement('input');
  trap.setAttribute('data-deedee-comment-honeypot', ''); trap.setAttribute('tabindex', '-1'); trap.setAttribute('autocomplete', 'off');
  trap.setAttribute('aria-hidden', 'true'); trap.style.cssText = 'position:absolute;left:-9999px;opacity:0;height:0;width:0;';
  composer.appendChild(trap);
  const status = doc.createElement('p'); status.className = 'deedee-local-comments__status'; status.setAttribute('role', 'status');
  status.hidden = true; composer.appendChild(status);
  const say = (kind, message) => { status.dataset.kind = kind; status.textContent = message; status.hidden = false; };

  publish.removeAttribute('disabled'); publish.textContent = text.post;
  const list = root.querySelector('[data-hook="top-level-comment-list"] > div') || root.querySelector('[data-hook="top-level-comment-list"]');
  renderComments(list, existing, doc, language);

  publish.addEventListener('click', async () => {
    if (publish.dataset.sending === 'true') return;
    const fields = { name: name.value, body: readEditor(editor) };
    const problem = validateComment(fields);
    if (problem) { say('error', text[problem]); return; }
    if (trap.value) { say('ok', text.sent); return; }
    let last = 0;
    try { last = Number(win.localStorage?.getItem('deedee-comment-last')) || 0; } catch { /* storage unavailable */ }
    if (Date.now() - last < COOLDOWN_MS) { say('error', text.wait); return; }
    publish.dataset.sending = 'true'; say('ok', text.sending);
    try {
      await submitComment(config, buildComment({ ...fields, pathname: win.location.pathname, language }), fetchImpl);
      editor.textContent = '';
      try { win.localStorage?.setItem('deedee-comment-last', String(Date.now())); } catch { /* storage unavailable */ }
      say('ok', text.sent);
    } catch { say('error', text.failed); } finally { delete publish.dataset.sending; }
  });
  return true;
}
