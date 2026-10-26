import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('recent article CTA follows the source /blog destination while menu news stays /news', async () => {
  const article = await readFile(new URL('../post/chia-khoa-cho-mot-quy-trinh-hop-tac-quoc-te/index.html', import.meta.url), 'utf8');
  const homepage = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const cta = article.match(/<a href="([^"]+)" class="vz0Mhy">Xem tất cả<\/a>/);

  assert.ok(cta, 'recent-post CTA should be present');
  assert.equal(cta[1], '/deedee-studio-static/blog/');
  assert.match(homepage, /<a href="\/deedee-studio-static\/news\/"[^>]*>(?:(?!<\/a>)[\s\S])*?Tin tức(?:(?!<\/a>)[\s\S])*?<\/a>/);
});
