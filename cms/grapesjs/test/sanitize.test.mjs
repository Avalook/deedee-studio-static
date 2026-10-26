import test from 'node:test';
import assert from 'node:assert/strict';

import { ContentPolicyError, sanitizeCss, sanitizeHtml } from '../lib/sanitize.mjs';

const MEDIA = '/media/11111111-1111-1111-1111-111111111111.png';

test('strips script tags and inline event handlers', () => {
  const out = sanitizeHtml('<p onclick="alert(1)">Hello<script>alert(1)</script></p>');
  assert.ok(!out.includes('<script'));
  assert.ok(!out.includes('onclick'));
  assert.ok(out.includes('Hello'));
});

test('removes javascript: links but keeps the anchor text', () => {
  const out = sanitizeHtml('<a href="javascript:alert(1)">Click</a>');
  assert.ok(!out.toLowerCase().includes('javascript:'));
  assert.ok(out.includes('Click'));
});

test('keeps allowed global and tag attributes', () => {
  const out = sanitizeHtml('<a class="cta" href="#contact" title="Go" aria-label="Contact">Go</a>');
  assert.match(out, /class="cta"/);
  assert.match(out, /href="#contact"/);
  assert.match(out, /title="Go"/);
  assert.match(out, /aria-label="Contact"/);
});

test('allows only demo artwork and uploaded media image sources', () => {
  const good = sanitizeHtml(`<img src="${MEDIA}" alt="Uploaded">`);
  assert.match(good, /<img/);
  assert.match(good, /src="\/media\/11111111-1111-1111-1111-111111111111\.png"/);
  assert.match(good, /loading="lazy"/);

  const demo = sanitizeHtml('<img src="/demo-art.svg" alt="Demo">');
  assert.match(demo, /<img/);

  const bad = sanitizeHtml('<img src="https://evil.example/tracker.png" alt="Tracker">');
  assert.ok(!bad.includes('<img'));
  assert.ok(!bad.includes('evil.example'));
  assert.ok(bad.includes('[Tracker]'));
});

test('accepts same-origin absolute media URLs and rewrites them to relative paths', () => {
  const origin = 'http://127.0.0.1:4174';
  const out = sanitizeHtml(`<img src="${origin}${MEDIA}" alt="Uploaded">`, { origin });
  assert.match(out, /<img/);
  assert.ok(!out.includes(origin));
  assert.match(out, new RegExp(`src="${MEDIA}"`));
});

test('adds noopener noreferrer to external links', () => {
  const out = sanitizeHtml('<a href="https://example.com" target="_blank">External</a>');
  assert.match(out, /rel="noopener noreferrer"/);
});

test('rejects unsafe stylesheet constructs', () => {
  assert.throws(() => sanitizeCss('@import url("https://evil.example/x.css");'), ContentPolicyError);
  assert.throws(() => sanitizeCss('.a{background:url("https://evil.example/x.png")}'), ContentPolicyError);
  assert.throws(() => sanitizeCss('.a{width:expression(alert(1))}'), ContentPolicyError);
  assert.throws(() => sanitizeCss('.a{behavior:url(#default#userData)}'), ContentPolicyError);
  assert.throws(() => sanitizeCss('.a{background:url("/other.png")}'), ContentPolicyError);

  const smooth = sanitizeCss('html{scroll-behavior:smooth}');
  assert.match(smooth, /scroll-behavior:smooth/);

  const good = sanitizeCss(`.poc-card{background-image:url("${MEDIA}");color:#141a22}`);
  assert.match(good, /url\("\/media\/11111111-1111-1111-1111-111111111111\.png"\)/);
});

test('removes unsafe inline styles instead of rejecting the save', () => {
  const out = sanitizeHtml('<p style="background:url(https://evil.example/x.png)">Text</p>');
  assert.ok(!out.includes('style='));
  assert.ok(!out.includes('evil.example'));
  assert.ok(out.includes('Text'));
});

test('keeps safe inline styles', () => {
  const out = sanitizeHtml('<div style="height:48px;width:50%">Spacer</div>');
  assert.match(out, /style="height:48px;width:50%"/);
});

test('enforces size limits', () => {
  assert.throws(() => sanitizeHtml('x'.repeat(2_000_001)), ContentPolicyError);
  assert.throws(() => sanitizeCss('x'.repeat(500_001)), ContentPolicyError);
});
