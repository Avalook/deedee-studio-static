import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNotification, sameSecret } from '../supabase/functions/notify-submission/email.mjs';

test('a form submission becomes a readable email', () => {
  const mail = buildNotification({ type: 'INSERT', table: 'form_submissions', record: { form_label: 'Liên hệ', name: 'Lan', page_path: '/contact-us',
    fields: [{ key: 'msg', label: 'Lời nhắn', value: 'Cần báo giá' }, { key: 'email', value: 'lan@example.com' }] } });
  assert.match(mail.subject, /Form mới: Liên hệ — Lan/);
  assert.match(mail.text, /Lời nhắn: Cần báo giá/); assert.match(mail.text, /email: lan@example\.com/);
});

test('a comment email says it is waiting for approval; other events and tables are ignored', () => {
  const mail = buildNotification({ type: 'INSERT', table: 'comments', record: { author_name: 'Minh', post_path: '/post/x', body: 'Hay' } });
  assert.match(mail.subject, /chờ duyệt — Minh/); assert.match(mail.text, /\/post\/x/);
  assert.equal(buildNotification({ type: 'UPDATE', table: 'comments', record: {} }), null);
  assert.equal(buildNotification({ type: 'INSERT', table: 'users', record: {} }), null);
  assert.equal(buildNotification(null), null);
  assert.ok(buildNotification({ type: 'INSERT', table: 'comments', record: { author_name: 'x', body: 'y'.repeat(9000) } }).text.length < 2500);
});

test('the webhook secret is compared strictly', () => {
  assert.equal(sameSecret('s3cret-value', 's3cret-value'), true);
  assert.equal(sameSecret('s3cret-valuf', 's3cret-value'), false);
  assert.equal(sameSecret('', ''), false, 'an unset secret never matches');
  assert.equal(sameSecret(null, 'x'), false);
});
