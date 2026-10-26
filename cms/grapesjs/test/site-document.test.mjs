import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptySiteDocument,
  validateSiteDocument,
} from '../lib/site-document.mjs';

test('creates a clean Vietnamese home page editing document', () => {
  assert.deepEqual(createEmptySiteDocument(), { schemaVersion: 1, pageId: '/', operations: [], insertions: [] });
  assert.deepEqual(createEmptySiteDocument('/aboutus/'), { schemaVersion: 1, pageId: '/aboutus', operations: [], insertions: [] });
});

test('normalizes safe local page routes and rejects traversal routes', () => {
  assert.equal(validateSiteDocument({ ...createEmptySiteDocument(), pageId: '/aboutus/' }).pageId, '/aboutus');
  assert.equal(validateSiteDocument({ ...createEmptySiteDocument(), pageId: '/post/v%C3%AD-d%E1%BB%A5' }).pageId, '/post/v%C3%AD-d%E1%BB%A5');
  for (const pageId of ['aboutus', '//evil.example', '/../private', '/a/../b', '/bad?query', '/bad%5cpath', '/bad%00path']) {
    assert.throws(() => validateSiteDocument({ ...createEmptySiteDocument(), pageId }));
  }
});

test('accepts validated text, image, style, and independent viewport offsets', () => {
  const input = {
    schemaVersion: 1,
    pageId: '/',
    operations: [{
      selector: '#comp-header-title',
      text: 'DeeDee Studio',
      href: '/contact-us',
      image: '/deedee-studio-static/assets/brand.png',
      width: 420,
      color: '#e6008d',
      responsive: { desktop: { fontSize: 42 }, laptop: { fontSize: 34 }, tablet: { fontSize: 28 }, mobile: { fontSize: 24, width: 300 } },
      offsets: { desktop: { x: 12, y: -4 }, laptop: { x: 8, y: -2 }, tablet: { x: 5, y: -1 }, mobile: { x: 2, y: 0 } },
    }],
  };

  assert.deepEqual(validateSiteDocument({ ...input, insertions: [] }), { ...input, insertions: [] });
});

test('accepts safe text, button, and uploaded image insertions', () => {
  const input = {
    ...createEmptySiteDocument(),
    insertions: [
      { id: 'add_123e4567-e89b-12d3-a456-426614174000', type: 'button', text: 'Contact', href: '/contact-us' },
      { id: 'add_123e4567-e89b-12d3-a456-426614174001', type: 'image', image: '/media/123e4567-e89b-12d3-a456-426614174001.webp' },
    ],
  };
  assert.deepEqual(validateSiteDocument(input), input);
});

test('accepts local and safe HTTPS links on editable elements', () => {
  for (const href of ['/contact-us', 'https://www.deedeestudio.net/our-work', 'mailto:contact@deedeestudio.net', 'tel:+84203415890']) {
    const document = validateSiteDocument({ ...createEmptySiteDocument(), operations: [{ selector: '#cta', href }] });
    assert.equal(document.operations[0].href, href);
  }
  for (const href of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', '//evil.example']) {
    assert.throws(() => validateSiteDocument({ ...createEmptySiteDocument(), operations: [{ selector: '#cta', href }] }));
  }
});

test('returns a new normalized document without mutating the input', () => {
  const input = createEmptySiteDocument();
  const result = validateSiteDocument(input);

  assert.notStrictEqual(result, input);
  assert.deepEqual(input.operations, []);
});

test('rejects unsupported pages, selectors, fields, and unsafe image paths', () => {
  const base = createEmptySiteDocument();
  const invalidCases = [
    { ...base, pageId: 'other' },
    { ...base, extra: true },
    { ...base, operations: [{ selector: 'body:has(script)', hidden: true }] },
    { ...base, operations: [{ selector: '#hero', onload: 'alert(1)' }] },
    { ...base, operations: [{ selector: '#hero', image: 'https://evil.example/a.png' }] },
    { ...base, operations: [{ selector: '#hero', href: 'javascript:alert(1)' }] },
    { ...base, operations: [{ selector: '#hero', responsive: { mobile: { width: '100vw' } } }] },
    { ...base, operations: [{ selector: '#hero', responsive: { phone: { fontSize: 12 } } }] },
    { ...base, operations: [{ selector: '#hero', offsets: { watch: { x: 1, y: 1 } } }] },
    { ...base, operations: [{ selector: '#hero', width: '100vw' }] },
    { ...base, operations: [], insertions: [{ id: 'add_123e4567-e89b-12d3-a456-426614174002', type: 'button', text: 'Bad', href: 'javascript:alert(1)' }] },
    { ...base, operations: [], insertions: [{ id: 'add_123e4567-e89b-12d3-a456-426614174002', type: 'html', text: '<script>' }] },
    { ...base, operations: [{ selector: '#hero', offsets: { desktop: { x: 10001, y: 0 } } }] },
  ];

  for (const input of invalidCases) {
    assert.throws(() => validateSiteDocument(input));
  }
});

test('rejects duplicate target operations and oversized operation lists', () => {
  const duplicate = {
    ...createEmptySiteDocument(),
    operations: [
      { selector: '#same', hidden: true },
      { selector: '#same', text: 'second write' },
    ],
  };
  const oversized = {
    ...createEmptySiteDocument(),
    operations: Array.from({ length: 1001 }, (_, index) => ({
      selector: `#item-${index}`,
      hidden: true,
    })),
  };

  assert.throws(() => validateSiteDocument(duplicate), /duplicate/i);
  assert.throws(() => validateSiteDocument(oversized), /too many/i);
});
