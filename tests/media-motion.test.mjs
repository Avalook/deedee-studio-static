import assert from 'node:assert/strict';
import test from 'node:test';
import { animationDuration, normalizePageRoute, safeMediaSource, partnerItems, createPlayer } from '../scripts/media-motion.mjs';
import { advanceMarquee } from '../scripts/partner-marquee.mjs';

test('uses the observed 40px/s marquee speed for one complete loop', () => {
  assert.equal(animationDuration(2245), 56125);
  assert.equal(animationDuration(0), 0);
  assert.equal(animationDuration(NaN), 0);
});

test('advances the partner marquee smoothly and wraps at one complete track', () => {
  assert.equal(advanceMarquee(100, 2500, 2245), 200);
  assert.equal(advanceMarquee(100, 2500, 2245, 0.5), 300);
  assert.equal(advanceMarquee(2200, 2000, 2245), 35);
  assert.equal(advanceMarquee(0, 1000, 0), 0);
  assert.equal(advanceMarquee(0, 1000, 100, 0), 0);
  assert.equal(advanceMarquee(0, NaN, 100), 0);
});

test('normalizes encoded and Pages-prefixed article routes', () => {
  assert.equal(normalizePageRoute('/deedee-studio-static/en/post/t%C3%AAn/'), '/en/post/tên');
  assert.equal(normalizePageRoute('/'), '/');
  assert.equal(normalizePageRoute('/post/%bad'), '/post/%bad');
});

test('accepts only known HTTPS video and embed providers', () => {
  const wix = { kind: 'video', src: 'https://video.wixstatic.com/video/abc/1080p/mp4/file.mp4' };
  assert.deepEqual(safeMediaSource(wix), wix);
  assert.equal(safeMediaSource({ kind: 'iframe', src: 'https://www.youtube.com/embed/hMVX8KZ5SXc' }).kind, 'iframe');
  assert.equal(safeMediaSource({ kind: 'iframe', src: 'https://player.vimeo.com/video/12345' }).kind, 'iframe');
  for (const src of ['javascript:alert(1)', 'http://video.wixstatic.com/x', 'https://evil.example/embed/123', 'https://www.youtube.com.evil.example/embed/hMVX8KZ5SXc', 'https://www.youtube.com/watch?v=hMVX8KZ5SXc']) {
    assert.equal(safeMediaSource({ kind: 'iframe', src }), null);
  }
  assert.equal(safeMediaSource(null), null);
  assert.equal(safeMediaSource({ kind: 'other', src: wix.src }), null);
});

test('collects the captured logo ratios once without mutating source images', () => {
  const images = [
    { src: 'https://local/assets/a.png', alt: '', style: { width: '299px', height: '80px' } },
    { src: 'https://local/assets/a.png', alt: '', style: { width: '299px', height: '80px' } },
    { src: 'https://local/assets/b.png', alt: 'Partner', style: { width: '74px', height: '80px' } },
  ];
  const before = JSON.stringify(images);
  assert.equal(partnerItems({ querySelectorAll: () => images }).length, 2);
  assert.equal(partnerItems({ querySelectorAll: () => images })[0].ratio, 299 / 80);
  assert.equal(JSON.stringify(images), before);
});

test('creates native video controls only when explicitly requested', () => {
  const doc = { createElement: tag => ({ tagName: tag, style: {}, setAttribute(name, value) { this[name] = value; } }) };
  const video = createPlayer(doc, { kind: 'video', src: 'https://video.wixstatic.com/video/abc/1080p/mp4/file.mp4' });
  assert.equal(video.tagName, 'video');
  assert.equal(video.controls, true);
  assert.equal(video.playsInline, true);
  const iframe = createPlayer(doc, { kind: 'iframe', src: 'https://www.youtube.com/embed/hMVX8KZ5SXc' });
  assert.equal(iframe.tagName, 'iframe');
  assert.match(iframe.src, /autoplay=1/);
  assert.equal(createPlayer(doc, { kind: 'iframe', src: 'https://evil.example/embed/123' }), null);
});
