import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAREERS_HEADING_CSS,
  FOOTER_FEEDBACK_CSS,
  installViewerFeedbackStyles,
} from '../scripts/viewer-feedback.mjs';

function fakeDocument() {
  const appended = [];
  return {
    appended,
    querySelector: () => appended[0] ?? null,
    createElement: () => ({ attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }),
    head: { appendChild: node => appended.push(node) },
  };
}

test('footer feedback keeps the menu on one row and tightens the text block, desktop only', () => {
  assert.match(FOOTER_FEEDBACK_CSS, /@media \(min-width: 1001px\)/);
  assert.match(FOOTER_FEEDBACK_CSS, /footer nav ul \{ flex-wrap: nowrap !important/);
  assert.match(FOOTER_FEEDBACK_CSS, /margin-top: -36px/);
});

test('careers heading keeps "ĐỘI NGŨ DEEDEE" together', () => {
  assert.match(CAREERS_HEADING_CSS, /#comp-m7786fs2 \.color_22 \{ display: inline-block; \}/);
});

test('styles are added once, and not when the pixel tools ask for the live layout', () => {
  const doc = fakeDocument();
  assert.equal(installViewerFeedbackStyles(doc, { location: { search: '' } }), true);
  assert.equal(doc.appended[0].attrs['data-deedee-viewer-feedback'], '');
  assert.match(doc.appended[0].textContent, /flex-wrap: nowrap/);
  assert.equal(installViewerFeedbackStyles(doc, { location: { search: '' } }), false, 'idempotent');
  const live = fakeDocument();
  assert.equal(installViewerFeedbackStyles(live, { location: { search: '?deedee-live-layout=1' } }), false);
  assert.equal(live.appended.length, 0);
  assert.equal(installViewerFeedbackStyles(undefined, undefined), false);
});
