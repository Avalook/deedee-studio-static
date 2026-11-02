import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { autoplayUrl, installProjectMobileVideo } from '../scripts/project-mobile-video.mjs';

const page = (player = '') => parseHTML(`<!doctype html><html><head></head><body>
  <div id="comp-m7r8escp"><a href="/deedee-studio-static"><svg></svg></a></div>${player}</body></html>`).document;
const YOUTUBE = '<iframe src="https://www.youtube.com/embed/abc?autoplay=0&amp;mute=0"></iframe>';

test('autoplay is switched on and the other player options stay', () => {
  const url = new URL(autoplayUrl('https://www.youtube.com/embed/abc?autoplay=0&mute=0&origin=https%3A%2F%2Fwww.deedeestudio.net'));
  assert.equal(url.searchParams.get('autoplay'), '1');
  assert.equal(url.searchParams.has('origin'), false);
  assert.equal(url.searchParams.get('mute'), '0');
});

test('the play button opens the page\'s video instead of leaving for the home page', () => {
  const doc = page(YOUTUBE);
  assert.equal(installProjectMobileVideo(doc), true);
  const link = doc.querySelector('a');
  const event = new doc.defaultView.Event('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  const frame = doc.querySelector('[data-deedee-video-overlay] iframe');
  assert.match(frame.getAttribute('src'), /youtube\.com\/embed\/abc\?autoplay=1/);
  doc.querySelector('[data-deedee-video-overlay] button').dispatchEvent(new doc.defaultView.Event('click'));
  assert.equal(doc.querySelector('[data-deedee-video-overlay]'), null);
});

test('without a video the tap does nothing, and pages without the button are left alone', () => {
  const doc = page();
  installProjectMobileVideo(doc);
  doc.querySelector('a').dispatchEvent(new doc.defaultView.Event('click', { bubbles: true, cancelable: true }));
  assert.equal(doc.querySelector('[data-deedee-video-overlay]'), null);
  assert.equal(installProjectMobileVideo(parseHTML('<html><body></body></html>').document), false);
});
