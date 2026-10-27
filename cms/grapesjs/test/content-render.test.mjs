import test from 'node:test';
import assert from 'node:assert/strict';
import { renderContentPage } from '../lib/content-render.mjs';

const article = {
  id: 'article-one', type: 'article', language: 'vi', slug: 'bai-viet-moi',
  route: '/post/bai-viet-moi/', title: 'Một bài viết mới', summary: 'Giới thiệu bài viết',
  cover: '/assets/cms/cover.webp', bodyHtml: '<h2>Nội dung</h2><p>Xin chào <strong>DeeDee</strong>.</p>',
  category: 'Hoạt động', author: 'DeeDee', publishedAt: '2026-10-27',
};

test('article generates a responsive standalone page with correct deployment links', () => {
  const html = renderContentPage(article, { basePath: '/deedee-studio-static' });
  assert.match(html, /<html lang="vi">/);
  assert.match(html, /<title>Một bài viết mới \| DeeDee Studio<\/title>/);
  assert.match(html, /href="\/deedee-studio-static\/news\/"/);
  assert.match(html, /src="\/deedee-studio-static\/assets\/cms\/cover.webp"/);
  assert.match(html, /<h2>Nội dung<\/h2>/);
  assert.match(html, /name="viewport"/);
  assert.doesNotMatch(html, /rel="canonical"/);
  const linked = renderContentPage({ ...article, bodyHtml: '<p><a href="/contact-us/">Liên hệ</a></p>' }, { basePath: '/deedee-studio-static' });
  assert.match(linked, /href="\/deedee-studio-static\/contact-us\/"/);
});

test('renderer escapes text and removes executable or unsafe body markup', () => {
  const html = renderContentPage({ ...article, title: '<img onerror=alert(1)>',
    cover: 'javascript:alert(1)', summary: '"><script>alert(1)</script>',
    bodyHtml: '<script>alert(1)</script><p onclick="alert(1)">Safe</p><a href="javascript:alert(1)">bad</a><img src="data:text/html,evil"><iframe src="https://evil.test"></iframe>',
  });
  assert.match(html, /&lt;img onerror=alert\(1\)&gt;/);
  assert.match(html, /<p>Safe<\/p>/);
  assert.doesNotMatch(html, /<script|onclick=|src="javascript:|href="javascript:|data:text\/html|<iframe/);
});

test('project renders gallery, metadata and only recognized video embeds', () => {
  const project = { ...article, type: 'project', language: 'en', route: '/en/all-project/new-film/',
    client: 'A & B', year: '2026', services: ['Animation', 'Design'],
    gallery: ['/media/picture.png', 'https://images.example.com/picture.webp', 'javascript:evil'],
    videoUrl: 'https://youtu.be/abcdefghijk',
  };
  const html = renderContentPage(project);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /Animation, Design/);
  assert.match(html, /https:\/\/www.youtube-nocookie.com\/embed\/abcdefghijk/);
  assert.match(html, /src="\/media\/picture.png"/);
  assert.match(html, /href="\/en\/our-work\/"/);
  assert.doesNotMatch(html, /javascript:evil/);
  assert.doesNotMatch(renderContentPage({ ...project, videoUrl: 'https://evil.test/embed/1' }), /<iframe/);
  assert.match(renderContentPage({ ...project, videoUrl: 'https://vimeo.com/12345678' }), /player.vimeo.com\/video\/12345678/);
});

test('canonical requires a verified HTTPS origin and prefixed asset URLs are not doubled', () => {
  const html = renderContentPage({ ...article, cover: '/deedee-studio-static/assets/cms/cover.webp' },
    { basePath: '/deedee-studio-static/', siteOrigin: 'https://example.com' });
  assert.match(html, /rel="canonical" href="https:\/\/example.com\/deedee-studio-static\/post\/bai-viet-moi\/"/);
  assert.doesNotMatch(html, /deedee-studio-static\/deedee-studio-static/);
  assert.doesNotMatch(renderContentPage(article, { siteOrigin: 'javascript:evil' }), /rel="canonical"/);
});
