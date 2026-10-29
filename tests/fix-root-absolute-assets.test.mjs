import assert from 'node:assert/strict';
import test from 'node:test';
import { fixHtml } from '../scripts/fix-root-absolute-assets.mjs';

test('puts the Pages prefix back on root-absolute asset URLs only', () => {
  const html = '<source srcset="/deedee-studio-static/assets/a.png 165w, /assets/a.png 330w"><img src="../assets/b.png"><a href="/deedee-studio-static/assets/c.png"><div style="background:url(/assets/d.png)">';
  const { html: fixed, count } = fixHtml(html);
  assert.equal(count, 2);
  assert.equal(fixed, '<source srcset="/deedee-studio-static/assets/a.png 165w, /deedee-studio-static/assets/a.png 330w"><img src="../assets/b.png"><a href="/deedee-studio-static/assets/c.png"><div style="background:url(/deedee-studio-static/assets/d.png)">');
  assert.equal(fixHtml(fixed).count, 0, 'running it again changes nothing');
});

import { cardImages, useSharpImages } from '../scripts/careers-card-images.mjs';

test('careers card thumbnails are swapped for the news ones, only for posts the news page knows', () => {
  const card = (src, slug) => `<img data-hook="gallery-item-image-img" src="${src}"><a href="/deedee-studio-static/en/post/${slug}/">t</a>`;
  const news = cardImages(card('/deedee-studio-static/assets/sharp.avif', 'a') + card('/deedee-studio-static/assets/sharp-b.avif', 'b'));
  assert.deepEqual([...news], [['a', '/deedee-studio-static/assets/sharp.avif'], ['b', '/deedee-studio-static/assets/sharp-b.avif']]);
  const careers = card('/deedee-studio-static/assets/blur-a.webp', 'a') + card('/deedee-studio-static/assets/blur-c.webp', 'c') + card('/deedee-studio-static/assets/blur-b.webp', 'b');
  const { html, changed } = useSharpImages(careers, news);
  assert.equal(changed, 2);
  assert.ok(html.includes('sharp.avif') && html.includes('sharp-b.avif') && html.includes('blur-c.webp'));
  assert.equal(useSharpImages(html, news).changed, 0);
  assert.equal(useSharpImages(careers, news, () => false).changed, 0, 'a missing file is never linked');
});
