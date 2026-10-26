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

test('Wix 404 route portfolio-tabs/2 redirects to its English fallback', async () => {
  const redirect = await readFile(new URL('../portfolio-tabs/2/index.html', import.meta.url), 'utf8');
  const english = await readFile(new URL('../en/portfolio-tabs/2/index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  const refresh = redirect.match(/<meta http-equiv="refresh" content="0;url=([^"]+)">/);

  assert.equal(refresh?.[1], '../../en/portfolio-tabs/2/');
  assert.match(redirect, /window\.location\.replace/);
  assert.match(english, /<title>404 Error: Page Not Found<\/title>/);
  assert.match(english, /ERROR: PAGE NOT FOUND/);
  assert.match(english, /This page isn’t available\./);
  assert.match(english, /Go to Homepage/);

  for (const route of ['/portfolio-tabs/2', '/en/portfolio-tabs/2']) {
    const page = manifest.pages.find((entry) => entry.route === route);
    assert.equal(page?.title, '404 Error: Page Not Found', `${route} manifest title should match Wix`);
  }
});

test('Wix 404 routes portfolio-tabs/3 and /4 mirror the localized Wix error template', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  const expectedHtml = await readFile(new URL('../en/portfolio-tabs/3/index.html', import.meta.url), 'utf8');

  assert.match(expectedHtml, /<title>404 Error: Page Not Found<\/title>/);
  assert.match(expectedHtml, /href="https:\/\/static\.parastorage\.com\/services\/classic-error-pages-statics\/1\.98\.0\/app\.min\.css"/);
  assert.match(expectedHtml, /madefor\.min\.css/);
  assert.match(expectedHtml, /madeforDisplay\.min\.css/);
  assert.match(expectedHtml, /class="ECJ82r" data-error-code="404" data-hook="root"/);
  assert.match(expectedHtml, /class="foBJFG ohOhpx" data-hook="error-app"/);
  assert.match(expectedHtml, /ERROR: PAGE NOT FOUND/);
  assert.match(expectedHtml, /This page isn’t available\./);
  assert.match(expectedHtml, /Go to Homepage/);
  assert.match(expectedHtml, /href="\.\.\/\.\.\/\.\.\/"/);

  for (const route of ['3', '4']) {
    const redirect = await readFile(new URL(`../portfolio-tabs/${route}/index.html`, import.meta.url), 'utf8');
    const english = await readFile(new URL(`../en/portfolio-tabs/${route}/index.html`, import.meta.url), 'utf8');
    const refresh = redirect.match(/<meta http-equiv="refresh" content="0;url=([^"]+)">/);

    assert.equal(refresh?.[1], `..\/..\/en\/portfolio-tabs\/${route}\/`);
    assert.match(redirect, /window\.location\.replace/);
    assert.equal(english, expectedHtml, `en/portfolio-tabs/${route} should use the shared Wix 404`);

    const routeRecords = manifest.pages.filter((page) => page.route === `/portfolio-tabs/${route}` || page.route === `/en/portfolio-tabs/${route}`);
    assert.equal(routeRecords.length, 2);
    assert.ok(routeRecords.every((page) => page.title === '404 Error: Page Not Found'));
  }

  const portfolioTwo = manifest.pages.find((page) => page.route === '/portfolio-tabs/2');
  assert.equal(portfolioTwo?.title, '404 Error: Page Not Found');
});

test('Wix 404 route portfolio-tabs/1 redirects to the local English fallback', async () => {
  const redirect = await readFile(new URL('../portfolio-tabs/1/index.html', import.meta.url), 'utf8');
  const english = await readFile(new URL('../en/portfolio-tabs/1/index.html', import.meta.url), 'utf8');
  const expected = await readFile(new URL('../en/portfolio-tabs/3/index.html', import.meta.url), 'utf8');
  const refresh = redirect.match(/<meta http-equiv="refresh" content="0;url=([^"]+)">/);

  assert.equal(refresh?.[1], '../../en/portfolio-tabs/1/');
  assert.match(redirect, /window\.location\.replace/);
  assert.equal(english, expected);
  assert.match(english, /<title>404 Error: Page Not Found<\/title>/);
});
