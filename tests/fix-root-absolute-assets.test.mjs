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

import { cards, retarget } from '../scripts/en-carrers-latest-posts.mjs';

test('the three /en/carrers cards are retargeted to the newest posts (title, link, image) and stay stable', () => {
  const item = (slug, title, img) => `<div data-hook="item-container"><a href="/deedee-studio-static/en/post/${slug}/"><img alt="${title}" src="${img}"></a><img alt="${title}" src="${img}2"><p>${title}</p></div>`;
  const page = `<div id="pro-gallery-comp-x">${item('old-a', 'Old A', '/a.jpg')}${item('old-b', 'Old &amp; B', '/b.jpg')}${item('old-c', 'Old C', '/c.jpg')}</div>`;
  const wanted = [{ slug: 'new-1', title: 'New 1', images: ['/n1.jpg'] }, { slug: 'new-2', title: 'New &amp; 2', images: ['/n2.jpg'] }, { slug: 'new-3', title: 'New 3', images: ['/n3.jpg'] }];
  const { html, changed } = retarget(page, 'comp-x', wanted);
  assert.equal(changed, 3);
  assert.deepEqual(cards(html, 'comp-x').map((c) => [c.slug, c.title, c.images.at(-1)]), [['new-1', 'New 1', '/n1.jpg'], ['new-2', 'New &amp; 2', '/n2.jpg'], ['new-3', 'New 3', '/n3.jpg']]);
  assert.ok(!/old-|Old /.test(html), 'nothing of the old posts is left');
  assert.equal(retarget(html, 'comp-x', wanted).changed, 0, 'running it again changes nothing');
});

test('retargeting the last card leaves the images and text after the gallery alone', () => {
  const item = (slug, img) => `<div data-hook="item-container"><a href="/en/post/${slug}/"><img alt="${slug}" src="${img}"></a></div>`;
  const after = '<section><img alt="bg" src="/bg.jpg"><img alt="logo" src="/logo.png"><a href="/en/post/old-c/">old-c</a></section>';
  const page = `<div id="pro-gallery-comp-x">${item('old-c', '/c.jpg')}<div data-key="items-styles"></div></div>${after}`;
  const { html, changed } = retarget(page, 'comp-x', [{ slug: 'new-1', title: 'new-1', images: ['/n1.jpg'] }]);
  assert.equal(changed, 1);
  assert.ok(html.endsWith(`<div data-key="items-styles"></div></div>${after}`), 'everything after the item list is untouched');
  assert.deepEqual(cards(html, 'comp-x').map((c) => [c.slug, c.images]), [['new-1', ['/n1.jpg']]]);
  assert.equal(retarget(html, 'comp-x', [{ slug: 'new-1', title: 'new-1', images: ['/n2.jpg'] }]).changed, 1, 'a new thumbnail alone is applied');
});

import { phoneFontRules, phoneCss, link } from '../scripts/add-post-phone-fonts.mjs';

test('phone heading sizes are derived from the page variables and the link is added once', () => {
  const html = '<style>.TPAMultiSection_l9pap7zt{--textH1Font: normal normal bold 30px/37px wfont_a,wf_b,orig_c; --textH2Font: normal normal bold 22px/27px wfont_d; --textH3Font: normal normal bold 18px/22px wfont_d; --textH5Font: normal normal bold 18px/22px wfont_d; --textH6Font: normal normal bold 18px/22px wfont_d; --textQuoteFont: italic normal normal 18px/22px wfont_d;}</style></head><body class="TPAMultiSection_l9pap7zt">';
  const lines = phoneFontRules(html);
  assert.equal(lines.length, 18);
  assert.match(lines[0], /--textH1Font: normal normal bold 26px\/37px wfont_a,wf_b,orig_c;/);
  assert.ok(lines.includes('    --textH3Font-size: 20px;') && lines.includes('    --textH3Font-line-height: 22px;'));
  assert.match(lines.at(-3), /--textQuoteFont: italic normal normal 20px\/22px wfont_d;/);
  assert.match(phoneCss(lines), /hover: none\) and \(pointer: coarse\)/);
  const once = link(html); assert.equal(once.changed, true); assert.equal(link(once.html).changed, false);
  assert.equal(link('<head></head><body>no article</body>').changed, false);
});
