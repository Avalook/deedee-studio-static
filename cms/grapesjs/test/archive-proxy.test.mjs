import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveArchiveUrl } from '../lib/archive-proxy.mjs';

test('resolves same-origin archive paths and preserves query strings', () => {
  const url = resolveArchiveUrl('/aboutus/?lang=vi', 'http://127.0.0.1:4173');

  assert.equal(url.href, 'http://127.0.0.1:4173/aboutus/?lang=vi');
});

test('rejects proxy targets that could escape the configured archive origin', () => {
  for (const target of [
    'https://example.com/private',
    '//example.com/private',
    '/\\\\example.com/private',
    '/path\u0000hidden',
  ]) {
    assert.throws(() => resolveArchiveUrl(target, 'http://127.0.0.1:4173'));
  }
});
