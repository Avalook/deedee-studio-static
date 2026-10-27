import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleBlocks, displayDate, loadArticleTemplates, readingMinutes, renderArticleFromTemplate } from '../lib/article-template.mjs';
import { renderContentPage } from '../lib/content-render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const templates = await loadArticleTemplates(ROOT);
const item = {
  type: 'article', language: 'vi', slug: 'bai-thu', route: '/post/bai-thu', title: 'Bài "thử" & <mới>', summary: 'Tóm tắt', category: 'Hoạt động', publishedAt: '2024-03-09T01:00:00Z',
  cover: '/deedee-studio-static/assets/a3720cd93eb4e63d57baa206.jpg',
  bodyHtml: '<p>Một <strong>đậm</strong> <em>nghiêng</em> <a href="https://example.com/a?x=1&amp;y=2">liên kết</a></p><h2>Phụ đề</h2><ul><li>A</li><li>B</li></ul><blockquote>Q</blockquote><figure><img src="/deedee-studio-static/assets/a3720cd93eb4e63d57baa206.jpg" alt="ảnh"><figcaption>Cap</figcaption></figure><hr>Đuôi',
};

test('body blocks use the article layout classes and keep inline formatting', () => {
  const html = articleBlocks(item.bodyHtml, '/deedee-studio-static');
  assert.match(html, /<p class="-wHo1 Z1Rmx IPM-j lxswf"[^>]*><span class="mQy7D">Một <strong style="font-weight:700">đậm<\/strong> <em style="font-style:italic">nghiêng<\/em> <a href="https:\/\/example.com\/a\?x=1&amp;y=2"/);
  assert.match(html, /<h2 class="Vhttk _91pHl IPM-j lxswf"[^>]*><span class="_3RJX8"><span style="color:#A139E0;text-decoration:inherit">Phụ đề/);
  assert.match(html, /<ul style="[^"]*list-style:disc outside"[^>]*><li style="[^"]*">A<\/li>/);
  assert.match(html, /<blockquote style="[^"]*border-left:4px solid #A139E0"[^>]*>Q<\/blockquote>/);
  assert.match(html, /<figure class="oH3fR">[\s\S]*<img src="\/deedee-studio-static\/assets\/a3720cd93eb4e63d57baa206.jpg" alt="ảnh"/);
  assert.match(html, /<em style="font-style:italic">Cap<\/em>/);
  assert.match(html, /<hr style=/);
  assert.match(html, /<span class="mQy7D">Đuôi<\/span>/, 'loose text becomes a paragraph');
  assert.equal(articleBlocks('', ''), '');
  assert.equal(articleBlocks('<p>   </p><p><br></p>', ''), '', 'empty paragraphs are dropped');
  assert.equal(articleBlocks('<img src="javascript:alert(1)">', ''), '', 'an unsafe image is dropped');
});

test('a published article keeps the site chrome, swaps the content and drops the template article\'s extras', () => {
  const html = renderContentPage(item, { basePath: '/deedee-studio-static', siteOrigin: 'https://deedee.example', templates });
  assert.match(html, /<title>Bài &quot;thử&quot; &amp; &lt;mới&gt; \| DeeDee Studio<\/title>|<title>Bài "thử" &amp; &lt;mới&gt; \| DeeDee Studio<\/title>/);
  assert.match(html, /<h1 class="H3vOVf" data-hook="post-title">Bài "thử" &amp; &lt;mới&gt;<\/h1>/);
  assert.match(html, /data-hook="time-ago">9 thg 3, 2024</);
  assert.match(html, /data-hook="time-to-read">1 phút đọc</);
  assert.match(html, /<a href="\/deedee-studio-static\/blog\/categories\/hoạt-động\/" class="Tp7c0d" data-hook="link">Hoạt động<\/a>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/deedee.example\/deedee-studio-static\/post\/bai-thu">/);
  assert.match(html, /og:image" content="https:\/\/deedee.example\/deedee-studio-static\/assets\/a3720cd93eb4e63d57baa206.jpg"/);
  assert.match(html, /<meta name="description" content="Tóm tắt">/);
  assert.ok(!html.includes('hreflang'), 'the template\'s language links are removed');
  assert.ok(!html.includes('data-hook="recent-posts"'), 'the template article\'s related posts are removed');
  assert.ok(!html.includes('Chìa khóa cho một quy trình'), 'nothing of the template article remains');
  assert.ok(html.includes('id="SITE_HEADER"') || html.includes('data-hook="hamburger-overlay-root"'), 'site header is kept');
  assert.match(html, /data-hook="wc-root [0-9a-f]{24}"/);
  assert.ok(!html.includes('6ab5faeb1b9782ba8f192d50'), 'the comment root id is per article');
});

test('a preview from the CMS root has no site base path, English uses the English template', () => {
  const rooted = { ...item, cover: '/assets/a3720cd93eb4e63d57baa206.jpg', bodyHtml: '<p>x</p>' };
  const preview = renderContentPage(rooted, { basePath: '', templates });
  assert.ok(!preview.includes('"/deedee-studio-static/'));
  const en = renderContentPage({ ...item, language: 'en', route: '/en/post/bai-thu', category: 'Expert Talk', publishedAt: '2026-01-05T00:00:00Z' }, { basePath: '/deedee-studio-static', templates });
  assert.match(en, /<html lang="en"/);
  assert.match(en, /data-hook="time-to-read">1 min read</);
  assert.match(en, /blog\/categories\/talk-interview-2\//);
  assert.ok(!en.includes('Does Adult Animation Always Look Mature?'));
});

test('without a template, or for a project, the plain layout is used', () => {
  assert.match(renderContentPage(item, { basePath: '' }), /class="eyebrow"/);
  assert.match(renderContentPage({ ...item, type: 'project', route: '/all-project/x' }, { basePath: '', templates }), /class="eyebrow"/);
  assert.throws(() => renderArticleFromTemplate(item, {}), /template is missing/);
});

test('reading time and display dates', () => {
  assert.equal(readingMinutes('<p>' + 'từ '.repeat(450) + '</p>'), 2);
  assert.equal(readingMinutes(''), 1);
  assert.equal(displayDate('2020-12-31T00:00:00Z', 'en'), 'Dec 31, 2020');
  assert.equal(displayDate('not a date', 'vi'), '');
});
