import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { HttpError, sendJson } from '../lib/http.mjs';
import { adminSettings, createSupabaseAdmin, SupabaseError, toCsv } from '../lib/supabase-admin.mjs';
import { createInboxRoutes } from '../lib/inbox-routes.mjs';

const URL_OK = 'https://abcdefgh.supabase.co';
const KEY = 'service-role-key-that-must-never-leak-0123456789';
const ID = '3b0c1f2e-1b0e-4f1e-9f45-6f4b8c1d2e3a';

test('admin settings need both the project URL and a service key from the environment', () => {
  assert.equal(adminSettings({ env: {}, configUrl: URL_OK }), null);
  assert.equal(adminSettings({ env: { SUPABASE_SERVICE_ROLE_KEY: KEY }, configUrl: '' }), null);
  assert.equal(adminSettings({ env: { SUPABASE_SERVICE_ROLE_KEY: 'short' }, configUrl: URL_OK }), null);
  assert.equal(adminSettings({ env: { SUPABASE_SERVICE_ROLE_KEY: KEY }, configUrl: 'http://evil.test' }), null);
  assert.deepEqual(adminSettings({ env: { SUPABASE_SERVICE_ROLE_KEY: KEY }, configUrl: `${URL_OK}/` }), { url: URL_OK, key: KEY });
  assert.deepEqual(adminSettings({ env: { SUPABASE_SERVICE_ROLE_KEY: KEY, SUPABASE_URL: URL_OK }, configUrl: '' }), { url: URL_OK, key: KEY });
});

test('the Supabase client builds bounded queries and never leaks the key', async () => {
  const calls = [];
  const respond = (status, body, headers = {}) => ({ status, ok: status < 300, headers: { get: (name) => headers[name.toLowerCase()] ?? null }, json: async () => body });
  let next = respond(200, [{ id: ID }], { 'content-range': '0-0/123' });
  const admin = createSupabaseAdmin({ url: URL_OK, key: KEY, fetchImpl: async (url, options) => { calls.push({ url, options }); return next; } });

  const page = await admin.list('forms', { status: 'pending', page: 3 });
  assert.equal(page.total, 123); assert.equal(page.page, 3);
  assert.equal(calls[0].url, `${URL_OK}/rest/v1/form_submissions?select=*&order=created_at.desc&limit=50&offset=100&handled=eq.false`);
  assert.equal(calls[0].options.headers.apikey, KEY); assert.match(calls[0].options.headers.Prefer, /count=exact/);
  await admin.list('comments', { status: 'done' });
  assert.match(calls[1].url, /comments\?select=\*&order=created_at\.desc&limit=50&offset=0&approved=eq\.true$/);
  await admin.list('comments', { status: 'all' });
  assert.doesNotMatch(calls[2].url, /approved=/);

  await admin.setDone('forms', ID, true);
  assert.deepEqual([calls[3].options.method, calls[3].options.body, calls[3].url.endsWith(`?id=eq.${ID}`)], ['PATCH', '{"handled":true}', true]);
  await admin.setDone('comments', ID, false);
  assert.equal(calls[4].options.body, '{"approved":false}');
  await admin.remove('comments', ID);
  assert.equal(calls[5].options.method, 'DELETE');
  await assert.rejects(admin.remove('forms', ID), /Chỉ được xóa bình luận/);
  await assert.rejects(admin.setDone('forms', "x' or '1'='1", true), /Mã không hợp lệ/);
  await assert.rejects(admin.list('users'), /Loại dữ liệu/);

  for (const [status, expected] of [[401, /từ chối khóa/], [404, /Chưa có bảng/], [500, /lỗi 500/]]) {
    next = respond(status, {});
    const error = await admin.list('forms').catch((caught) => caught);
    assert.ok(error instanceof SupabaseError); assert.match(error.message, expected); assert.ok(!error.message.includes(KEY));
  }
  const offline = createSupabaseAdmin({ url: URL_OK, key: KEY, fetchImpl: async () => { throw new Error(`connect ${KEY}`); } });
  const error = await offline.list('forms').catch((caught) => caught);
  assert.match(error.message, /Không kết nối/); assert.ok(!error.message.includes(KEY));
});

test('CSV export quotes cells and defuses spreadsheet formulas', () => {
  const csv = toCsv('forms', [{ created_at: '2026-10-01', form_label: 'Liên hệ', language: 'vi', page_path: '/contact-us', name: '=HYPERLINK("http://x")', email: 'a@b.c', phone: '+84 90', handled: false,
    fields: [{ key: 'msg', label: 'Lời nhắn', value: 'Xin chào, "bạn"\nhai dòng' }] }]);
  assert.ok(csv.startsWith('﻿created_at,form_label'));
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)"/);
  assert.match(csv, /'\+84 90/);
  assert.match(csv, /"Lời nhắn: Xin chào, ""bạn""\nhai dòng"/);
  assert.match(toCsv('comments', [{ created_at: 'd', post_path: '/p', language: 'en', author_name: '@evil', body: 'ok', approved: true }]), /'@evil,ok,true/);
});

test('inbox routes: publishers only, CSRF on changes, graceful when Supabase is not configured', async (t) => {
  const log = [];
  const admin = { list: async (kind, options) => { log.push(['list', kind, options]); return { items: [{ id: ID, name: 'An' }], total: 1, page: 1, pageSize: 50 }; },
    listAll: async () => [{ created_at: 'd', form_label: 'f', language: 'vi', page_path: '/', name: 'n', email: 'e', phone: 'p', handled: false, fields: [] }],
    setDone: async (...args) => log.push(['done', ...args]), remove: async (...args) => log.push(['remove', ...args]) };
  const sessions = { editor: { user: { role: 'editor' }, csrf: 'c1' }, publisher: { user: { role: 'publisher' }, csrf: 'c2' } };
  const requireSession = (req) => { const session = sessions[req.headers['x-test-user']]; if (!session) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED'); return session; };
  const requireCsrf = (req, session) => { if (req.headers['x-csrf-token'] !== session.csrf) throw new HttpError(403, 'CSRF', 'CSRF'); };
  const requirePublisher = (session) => { if (!['publisher', 'admin'].includes(session.user.role)) throw new HttpError(403, 'Publisher role required', 'FORBIDDEN'); };
  const build = (adminImpl) => createInboxRoutes({ requireSession, requireCsrf, requirePublisher, publicDir: '/nonexistent', admin: adminImpl });
  const serve = async (routes) => {
    const server = createServer(async (req, res) => {
      try { if (!(await routes(req, res, new URL(req.url, 'http://x')))) sendJson(res, 404, {}); } catch (error) { sendJson(res, error.status || 500, { error: { code: error.code, message: error.message } }); }
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.close());
    return `http://127.0.0.1:${server.address().port}`;
  };
  const origin = await serve(build(admin));
  const call = (path, { user = 'publisher', method = 'GET', csrf, body } = {}) => fetch(origin + path, { method, headers: { 'x-test-user': user, ...(csrf ? { 'x-csrf-token': csrf } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });

  assert.equal((await call('/api/inbox', { user: 'none' })).status, 401);
  assert.equal((await call('/api/inbox', { user: 'editor' })).status, 403, 'editors never see visitors\' personal data');
  const listed = await (await call('/api/inbox?kind=comments&status=done&page=2')).json();
  assert.equal(listed.configured, true); assert.deepEqual(log.at(-1), ['list', 'comments', { status: 'done', page: '2' }]);
  assert.equal((await call('/api/inbox?kind=users')).status, 400);
  const csv = await call('/api/inbox/export.csv?kind=forms');
  assert.match(csv.headers.get('content-type'), /text\/csv/); assert.match(csv.headers.get('content-disposition'), /deedee-forms\.csv/);
  assert.equal((await call(`/api/inbox/forms/${ID}`, { method: 'PATCH', body: { done: true } })).status, 403, 'no CSRF token');
  assert.equal((await call(`/api/inbox/forms/${ID}`, { method: 'PATCH', csrf: 'c2', body: { done: 'yes' } })).status, 400);
  assert.equal((await call(`/api/inbox/forms/${ID}`, { method: 'PATCH', csrf: 'c2', body: { done: true } })).status, 200);
  assert.deepEqual(log.at(-1), ['done', 'forms', ID, true]);
  assert.equal((await call(`/api/inbox/comments/${ID}`, { method: 'DELETE', csrf: 'c2' })).status, 200);
  assert.deepEqual(log.at(-1), ['remove', 'comments', ID]);
  assert.equal((await call('/api/inbox/nothing')).status, 404);

  const bare = await serve(build(null));
  const unconfigured = await (await fetch(`${bare}/api/inbox`, { headers: { 'x-test-user': 'publisher' } })).json();
  assert.deepEqual(unconfigured, { configured: false, items: [], total: 0 });
  assert.equal((await fetch(`${bare}/api/inbox/export.csv`, { headers: { 'x-test-user': 'publisher' } })).status, 409);
  const failing = await serve(build({ list: async () => { throw new SupabaseError(401, 'Supabase từ chối khóa service_role.'); } }));
  assert.equal((await fetch(`${failing}/api/inbox`, { headers: { 'x-test-user': 'publisher' } })).status, 502);
});
