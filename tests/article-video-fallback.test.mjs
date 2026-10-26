import assert from 'node:assert/strict';
import test from 'node:test';
import { installArticleVideoFallback, videoEmbedFor } from '../scripts/article-video-fallback.mjs';

test('YouTube links of every common shape become embeds', () => {
  for (const href of ['https://youtube.com/watch?v=0952h8ai-2I&feature=shares', 'https://www.youtube.com/watch?v=js5P1CeBERY',
    'https://m.youtube.com/watch?v=js5P1CeBERY', 'https://youtu.be/js5P1CeBERY']) {
    assert.match(videoEmbedFor(href).src, /^https:\/\/www\.youtube\.com\/embed\/[\w-]+$/, href);
  }
  assert.equal(videoEmbedFor('https://youtube.com/watch?v=-ZJIYKwg2qE').src, 'https://www.youtube.com/embed/-ZJIYKwg2qE');
});

test('Vimeo and Facebook video links are recognised only in their exact shape', () => {
  assert.equal(videoEmbedFor('https://vimeo.com/760234032').src, 'https://player.vimeo.com/video/760234032');
  const fb = videoEmbedFor('https://www.facebook.com/IFVHanoi/videos/276834844458206');
  assert.equal(fb.src, 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2FIFVHanoi%2Fvideos%2F276834844458206&show_text=false');
  for (const bad of ['https://vimeo.com/channels/x', 'https://www.facebook.com/IFVHanoi', 'https://www.facebook.com/a/b/videos/1',
    'https://evil.example/watch?v=js5P1CeBERY', 'https://youtube.com.evil.example/watch?v=js5P1CeBERY', 'https://youtube.com/watch?v=<script>',
    'javascript:alert(1)', 'not a url', '', null]) {
    assert.equal(videoEmbedFor(bad), null, String(bad));
  }
});

function fakeRoot(hrefs) {
  const holders = hrefs.map(href => ({ replaced: null, replaceChildren(node) { this.replaced = node; } }));
  const links = hrefs.map((href, i) => ({ getAttribute: () => href, parentElement: holders[i] }));
  const root = {
    querySelectorAll: selector => (selector === '[data-hook="video-player"] a[data-hook="video-ssr-viewer"]' ? links : []),
    createElement: () => ({ attrs: {}, style: {}, setAttribute(name, value) { this.attrs[name] = value; } }),
  };
  return { root, holders };
}

test('bare video links are replaced with a responsive iframe; unknown ones stay', () => {
  const { root, holders } = fakeRoot(['https://www.youtube.com/watch?v=js5P1CeBERY', 'https://example.com/video']);
  assert.equal(installArticleVideoFallback(root), 1);
  assert.equal(holders[0].replaced.attrs.src, 'https://www.youtube.com/embed/js5P1CeBERY');
  assert.match(holders[0].replaced.style.cssText, /aspect-ratio:16\/9/);
  assert.equal(holders[1].replaced, null);
  assert.equal(installArticleVideoFallback(undefined), 0);
});
