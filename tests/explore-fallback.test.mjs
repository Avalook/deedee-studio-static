import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('explore redirects to the Wix English 404 while the GitHub fallback remains available', async () => {
  const route = await readFile(new URL('../explore/index.html', import.meta.url), 'utf8');
  const englishExplore = await readFile(new URL('../en/explore/index.html', import.meta.url), 'utf8');
  const githubFallback = await readFile(new URL('../404.html', import.meta.url), 'utf8');
  const errorStyles = await readFile(new URL('../assets/error-page.css', import.meta.url), 'utf8');

  assert.match(errorStyles, /\.error-page\s*\{[^}]*display:\s*flow-root;[^}]*width:\s*50%;[^}]*margin:\s*56\.8px 0 56\.8px 5%;/s);

  assert.match(route, /<title>Redirecting \| DeeDee Studio<\/title>/);
  assert.match(route, /<meta http-equiv="refresh" content="0;url=\/deedee-studio-static\/en\/explore\/">/);
  assert.match(route, /<link rel="canonical" href="\/deedee-studio-static\/en\/explore\/">/);
  assert.match(route, /href="\/deedee-studio-static\/en\/explore\/">Continue to DeeDee Studio/);

  assert.match(englishExplore, /<title>404 Error: Page not found<\/title>/);
  assert.match(englishExplore, /ERROR: PAGE NOT FOUND/);
  assert.match(englishExplore, /This page is unavailable\./);
  assert.match(englishExplore, /error-page\.css/);
  assert.match(englishExplore, /href="\/deedee-studio-static\/en\/">Go to Home/);

  assert.match(githubFallback, /LỖI: KHÔNG TÌM THẤY TRANG/);
  assert.match(githubFallback, /404/);
  assert.match(githubFallback, /Trang này không khả dụng\./);
  assert.match(githubFallback, /error-page\.css/);
  assert.match(githubFallback, /href="\/deedee-studio-static\/"[^>]*>\s*Đi tới Trang chủ/);
});

test('the old portfolio-tabs routes redirect to the matching tab of Our work, in their own language', async () => {
  const base = '/deedee-studio-static';
  for (const [prefix, language] of [['', 'vi'], ['en/', 'en']]) {
    for (const tab of ['1', '2', '3', '4']) {
      const html = await readFile(new URL(`../${prefix}portfolio-tabs/${tab}/index.html`, import.meta.url), 'utf8');
      const target = `${base}/${prefix}our-work/${tab === '1' ? '' : `?tab=${tab}`}`;
      assert.match(html, new RegExp(`<html lang="${language}">`));
      assert.ok(html.includes(`<meta http-equiv="refresh" content="0; url=${target}">`), `${prefix}portfolio-tabs/${tab}`);
      assert.ok(html.includes('content="noindex"'));
      assert.doesNotMatch(html, /404/);
    }
  }
});
