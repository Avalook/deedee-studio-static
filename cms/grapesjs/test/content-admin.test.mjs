import assert from 'node:assert/strict';
import test from 'node:test';
import { blankContent, contentPayload, createContentClient, publicationLabel, slugify, wrapSelection } from '../public/admin/content-model.js';

test('new article/project drafts have isolated arrays and locale defaults', () => {
  const article = blankContent();
  const project = blankContent('project', 'en');
  assert.equal(article.type, 'article');
  assert.equal(project.language, 'en');
  assert.notEqual(article.gallery, project.gallery);
  assert.equal(article.featured, false);
});

test('Vietnamese title becomes portable slug without unsafe route characters', () => {
  assert.equal(slugify('Đội ngũ DeeDee — Chào năm 2026!'), 'doi-ngu-deedee-chao-nam-2026');
  assert.equal(slugify('../../Đường dẫn'), 'duong-dan');
});

test('serializes only authorable fields and never mutates source', () => {
  const source = { ...blankContent(), id: 'private-id', status: 'published', gallery: ['/media/a.png'] };
  const payload = contentPayload(source);
  assert.equal(payload.id, undefined);
  assert.equal(payload.status, undefined);
  assert.equal(Object.hasOwn(payload, 'publishedAt'), false);
  assert.equal(contentPayload({ ...source, publishedAt: '2026-10-27' }).publishedAt, '2026-10-27');
  assert.notEqual(payload.gallery, source.gallery);
  assert.equal(source.id, 'private-id');
});

test('status explains changes independently of live publication', () => {
  assert.equal(publicationLabel({ isPublished: true, hasUnpublishedChanges: true }), 'Có thay đổi chưa xuất bản');
  assert.equal(publicationLabel({ isPublished: true }), 'Đã xuất bản');
  assert.equal(publicationLabel({ isPublished: false }), 'Bản nháp');
});

test('formatting wraps selected text and escapes plain text safely', () => {
  assert.deepEqual(wrapSelection('hello world', 6, 11, 'strong'), { value: 'hello <strong>world</strong>', start: 14, end: 19 });
  assert.equal(wrapSelection('', 0, 0, 'h2').value, '<h2>Tiêu đề</h2>');
  assert.throws(() => wrapSelection('x', 0, 1, 'script'), /định dạng/);
});

test('client sends CSRF only on writes and serialized draft envelope', async () => {
  const requests = [];
  const client = createContentClient(async (url, options) => {
    requests.push({ url, ...options });
    return { ok: true, status: 200, json: async () => ({ item: { id: 'a' }, items: [] }) };
  }, 'csrf-test');
  await client.list();
  await client.save(null, blankContent());
  await client.save('a', blankContent());
  await client.publish('a');
  await client.unpublish('a');
  assert.equal(requests[0].headers['X-CSRF-Token'], undefined);
  assert.equal(requests[1].headers['X-CSRF-Token'], 'csrf-test');
  assert.equal(JSON.parse(requests[1].body).item.type, 'article');
  assert.equal(requests[2].method, 'PUT');
  assert.equal(requests[3].url, '/api/content/a/publish');
  assert.equal(requests[4].url, '/api/content/a/unpublish');
});

test('client surfaces structured validation errors and session expiry', async () => {
  const client = createContentClient(async () => ({ ok: false, status: 422, json: async () => ({ error: { message: 'Đường dẫn đã tồn tại' } }) }), 'csrf');
  await assert.rejects(client.save(null, blankContent()), /Đường dẫn đã tồn tại/);
  const expired = createContentClient(async () => ({ ok: false, status: 401, json: async () => ({}) }), 'csrf');
  await assert.rejects(expired.list(), error => error.status === 401 && /Đăng nhập/.test(error.message));
  const broken = createContentClient(async () => ({ ok: false, status: 500, json: async () => { throw new Error('invalid'); } }), 'csrf');
  await assert.rejects(broken.list(), /500/);
});

test('client upload preserves multipart content type and rejects empty server result', async () => {
  let captured;
  const client = createContentClient(async (_url, options) => {
    captured = options;
    return { ok: true, status: 200, json: async () => ({ data: [{ src: '/media/photo.png' }] }) };
  }, 'csrf');
  assert.equal(await client.upload(new Blob(['image'], { type: 'image/png' })), '/media/photo.png');
  assert.equal(captured.headers['Content-Type'], undefined);
  assert.equal(captured.headers['X-CSRF-Token'], 'csrf');
  const empty = createContentClient(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }), 'csrf');
  await assert.rejects(empty.upload(new Blob(['x'])), /đường dẫn ảnh/);
});
