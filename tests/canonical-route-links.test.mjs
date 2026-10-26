import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeRouteHref,
  createLocalRouteSet,
  createManifestRouteSet,
  repairInternalRouteLinks,
  rewriteRouteLinksHtml,
} from '../scripts/canonical-route-links.mjs';

const routes = new Set([
  '/',
  '/en',
  '/post/a-story',
  '/en/post/a-story',
  '/all-project/let-victory-make-history',
  '/en/our-work',
  '/en/all-project/broken-being:-the-prequel',
  '/en/aboutus',
  '/en/all-project/awaken',
  '/en/all-project/the-silver-ion-squad',
  '/en/all-project/the-hero',
  '/en/all-project/general,-please-mind-your-manner',
  '/en/all-project/the-naugh-nice-business',
  '/en/all-project/glorious-mission',
  '/en/post/different-approaches-layout-design',
  '/en/all-project/she-kings',
  '/en/all-project/fun-with-traffic',
  '/en/all-project/loving-kieu',
  '/en/webinar',
  '/en/explore/categories/12-rules',
]);

test('rewrites DeeDee-owned legacy hosts and aliases to verified local routes', () => {
  const routesFromArchive = new Set([
    '/',
    '/en',
    '/post/a-story',
    '/en/post/a-story',
    '/en/our-work',
    '/en/all-project/broken-being:-the-prequel',
    '/en/webinar',
    '/en/explore/categories/12-rules',
  ]);
  const html = '<html lang="en"><body>'
    + '<a href="https://en.deedeestudio.net/work">Work</a>'
    + '<a href="https://en.deedeestudio.net/broken-being">Project</a>'
    + '<a href="https://vi.deedeestudio.net/post/a-story?q=1&amp;lang=vi#comments">VI article</a>'
    + '<a href="https://en.deedeestudio.net/explore/categories/12-rules">Unresolved feed</a>'
    + '<a href="https://en.deedeestudio.net/webinar">Unresolved event</a>'
    + '<a href="https://outside.example/post/a-story">External</a>'
    + '<a href="http://www.deedeestudio.net/">Locale home</a>'
    + '</body></html>';
  assert.equal(
    rewriteRouteLinksHtml(html, routesFromArchive),
    '<html lang="en"><body>'
      + '<a href="/deedee-studio-static/en/our-work/">Work</a>'
      + '<a href="/deedee-studio-static/en/all-project/broken-being%3A-the-prequel/">Project</a>'
      + '<a href="/deedee-studio-static/post/a-story/?q=1&amp;lang=vi#comments">VI article</a>'
      + '<a href="/deedee-studio-static/en/explore/categories/12-rules/">Unresolved feed</a>'
      + '<a href="/deedee-studio-static/en/webinar/">Unresolved event</a>'
      + '<a href="https://outside.example/post/a-story">External</a>'
      + '<a href="/deedee-studio-static/en/">Locale home</a>'
      + '</body></html>',
  );
});

test('restores only empty DeeDee tagline links using the rendered page locale', () => {
  const vi = '<html lang="vi"><a href="" class="footer wixui-rich-text__text">DeeDee Animation Studio</a>'
    + '<a href="" class="wixui-rich-text__text">Other text</a></html>';
  const en = '<html lang="en"><a href="" class="wixui-rich-text__text">DeeDee Animation Studio</a></html>';
  assert.equal(
    rewriteRouteLinksHtml(vi, routes),
    '<html lang="vi"><a href="/deedee-studio-static/" class="footer wixui-rich-text__text">DeeDee Animation Studio</a>'
      + '<a href="" class="wixui-rich-text__text">Other text</a></html>',
  );
  assert.equal(
    rewriteRouteLinksHtml(en, routes),
    '<html lang="en"><a href="/deedee-studio-static/en/" class="wixui-rich-text__text">DeeDee Animation Studio</a></html>',
  );
});

test('adds a directory slash to exact internal manifest routes and preserves query/hash', () => {
  assert.equal(
    canonicalizeRouteHref('/deedee-studio-static/post/a-story?tab=2#comments', routes),
    '/deedee-studio-static/post/a-story/?tab=2#comments',
  );
  assert.equal(
    canonicalizeRouteHref('/en/post/a-story', routes),
    '/en/post/a-story/',
  );
  assert.equal(
    canonicalizeRouteHref('https://www.deedeestudio.net/all-project/let-victory-make-history', routes),
    '/deedee-studio-static/all-project/let-victory-make-history/',
  );
});

test('leaves root, already canonical, external, asset, fragment, and unknown links unchanged', () => {
  for (const href of [
    '/',
    '/deedee-studio-static/',
    '/deedee-studio-static/post/a-story/',
    'https://example.org/post/a-story',
    '/deedee-studio-static/assets/logo.png',
    '#gallery',
    'mailto:hello@example.org',
    '/deedee-studio-static/post/not-in-manifest',
  ]) {
    assert.equal(canonicalizeRouteHref(href, routes), href, href);
  }
});

test('rewrites only matching anchor href values and preserves the surrounding HTML bytes', () => {
  const html = '<a class="story" href="/deedee-studio-static/post/a-story?from=home&amp;lang=vi">Open</a>'
    + '<a href="https://example.org/post/a-story">External</a>'
    + '<a href="/deedee-studio-static/post/not-in-manifest">Unknown</a>';
  const result = rewriteRouteLinksHtml(html, routes);
  assert.equal(
    result,
    '<a class="story" href="/deedee-studio-static/post/a-story/?from=home&amp;lang=vi">Open</a>'
      + '<a href="https://example.org/post/a-story">External</a>'
      + '<a href="/deedee-studio-static/post/not-in-manifest">Unknown</a>',
  );
});

test('repairs only manifest pages in a temporary site tree', async () => {
  const { mkdtemp, mkdir, readFile, rm, writeFile } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-route-links-'));
  try {
    await mkdir(path.join(root, 'post', 'a-story'), { recursive: true });
    const pageFile = path.join(root, 'post', 'a-story', 'index.html');
    await writeFile(pageFile, '<a href="/deedee-studio-static/post/a-story">Story</a>');
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify({
      pages: [{ route: '/post/a-story', file: 'post/a-story/index.html' }],
    }));
    await writeFile(path.join(root, 'project-pages.json'), JSON.stringify({
      pages: [{ items: ['<a href="/deedee-studio-static/post/a-story">Story</a>'] }],
    }));

    const summary = await repairInternalRouteLinks({ root });
    assert.deepEqual(summary, { pagesChanged: 1, linksChanged: 1, dataLinksChanged: 1 });
    assert.equal(await readFile(pageFile, 'utf8'), '<a href="/deedee-studio-static/post/a-story/">Story</a>');
    assert.equal(
      JSON.parse(await readFile(path.join(root, 'project-pages.json'), 'utf8')).pages[0].items[0],
      '<a href="/deedee-studio-static/post/a-story/">Story</a>',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('can skip generated project data while repairing archived HTML pages', async () => {
  const { mkdtemp, mkdir, readFile, rm, writeFile } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-route-links-pages-only-'));
  try {
    await mkdir(path.join(root, 'post', 'a-story'), { recursive: true });
    const pageFile = path.join(root, 'post', 'a-story', 'index.html');
    const dataFile = path.join(root, 'project-pages.json');
    await writeFile(pageFile, '<a href="/deedee-studio-static/post/a-story">Story</a>');
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify({
      pages: [{ route: '/post/a-story', file: 'post/a-story/index.html' }],
    }));
    const originalData = JSON.stringify({
      pages: [{ items: ['<a href="/deedee-studio-static/post/a-story">Story</a>'] }],
    });
    await writeFile(dataFile, originalData);

    const summary = await repairInternalRouteLinks({ root, includeProjectData: false });
    assert.deepEqual(summary, { pagesChanged: 1, linksChanged: 1, dataLinksChanged: 0 });
    assert.equal(await readFile(pageFile, 'utf8'), '<a href="/deedee-studio-static/post/a-story/">Story</a>');
    assert.equal(await readFile(dataFile, 'utf8'), originalData);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('can exclude pages currently owned by another focused repair', async () => {
  const { mkdtemp, mkdir, readFile, rm, writeFile } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-route-links-excluded-'));
  try {
    await mkdir(path.join(root, 'post', 'a-story'), { recursive: true });
    const pageFile = path.join(root, 'post', 'a-story', 'index.html');
    const original = '<a href="/deedee-studio-static/post/a-story">Story</a>';
    await writeFile(pageFile, original);
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify({
      pages: [{ route: '/post/a-story', file: 'post/a-story/index.html' }],
    }));

    const summary = await repairInternalRouteLinks({
      root,
      includeProjectData: false,
      excludeFiles: ['post/a-story/index.html'],
    });
    assert.deepEqual(summary, { pagesChanged: 0, linksChanged: 0, dataLinksChanged: 0 });
    assert.equal(await readFile(pageFile, 'utf8'), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('generated project cards canonicalize internal route links before publication', async () => {
  const routesFromManifest = createManifestRouteSet([
    { route: '/all-project/example' },
    { route: '/post/story' },
  ]);
  assert.equal(
    rewriteRouteLinksHtml('<a href="/deedee-studio-static/all-project/example">Project</a>', routesFromManifest),
    '<a href="/deedee-studio-static/all-project/example/">Project</a>',
  );
});

test('route discovery includes local pages omitted from the crawl manifest', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-local-routes-'));
  try {
    await mkdir(path.join(root, 'en', 'service'), { recursive: true });
    await writeFile(path.join(root, 'en', 'service', 'index.html'), '<!doctype html>');
    await mkdir(path.join(root, 'outputs', 'generated'), { recursive: true });
    await writeFile(path.join(root, 'outputs', 'generated', 'index.html'), '<!doctype html>');
    const routesFromFiles = await createLocalRouteSet(root);
    assert.equal(routesFromFiles.has('/en/service'), true);
    assert.equal(routesFromFiles.has('/outputs/generated'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('archives the verified Wix 404 at the exact English 12-rules route', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.resolve(import.meta.dirname, '..');
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const page = manifest.pages.find(candidate => candidate.route === '/en/explore/categories/12-rules');
  assert.equal(page?.file, 'en/explore/categories/12-rules/index.html');
  assert.match(page?.title ?? '', /404 Error: Page not found/);
  const markup = await readFile(path.join(root, page.file), 'utf8');
  assert.match(markup, /<h1 class="error-page__code">404<\/h1>/);
  assert.match(markup, /This page is unavailable\./);
  assert.match(markup, /href="\/deedee-studio-static\/en\/"/);
});

test('archives the verified English webinar route and localizes its Wix media', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { parse } = await import('parse5');
  const root = path.resolve(import.meta.dirname, '..');
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const page = manifest.pages.find(candidate => candidate.route === '/en/webinar');
  assert.equal(page?.file, 'en/webinar/index.html');
  assert.equal(page?.canonicalRoute, '/en/webinar');
  assert.equal(page?.captureStatus, 200);
  assert.match(page?.title ?? '', /WEBINAR/);
  const markup = await readFile(path.join(root, page.file), 'utf8');
  assert.match(markup, /rel="canonical" href="\/deedee-studio-static\/en\/webinar"/);
  const activeMediaUrls = [];
  const visit = node => {
    if (node.tagName !== 'script') {
      for (const attribute of node.attrs ?? []) {
        if (['src', 'srcset', 'poster', 'href', 'style'].includes(attribute.name)
          && /https?:\/\/static\.wixstatic\.com\/media\//i.test(attribute.value)) {
          activeMediaUrls.push(attribute.value);
        }
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(markup));
  assert.deepEqual(activeMediaUrls, []);
});

test('archives the linked webinar detail page and points its card to the local route', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.resolve(import.meta.dirname, '..');
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const page = manifest.pages.find(candidate => candidate.route === '/en/webinar-popular-types-animation');
  assert.equal(page?.file, 'en/webinar-popular-types-animation/index.html');
  assert.equal(page?.canonicalRoute, '/en/webinar-popular-types-animation');
  assert.equal(page?.captureStatus, 200);
  assert.match(page?.title ?? '', /Popular types of animation in advertising/i);
  const [detail, webinar] = await Promise.all([
    readFile(path.join(root, page.file), 'utf8'),
    readFile(path.join(root, 'en/webinar/index.html'), 'utf8'),
  ]);
  assert.match(detail, /rel="canonical" href="\/deedee-studio-static\/en\/webinar-popular-types-animation"/);
  assert.match(webinar, /href="\/deedee-studio-static\/en\/webinar-popular-types-animation\/"/);
});

test('preserves the three source-equivalent webinar title labels without hrefs', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { parse } = await import('parse5');
  const root = path.resolve(import.meta.dirname, '..');
  const markup = await readFile(path.join(root, 'en/webinar/index.html'), 'utf8');
  const noHrefLabels = [];
  const cardLinks = [];
  const textContent = node => node.nodeName === '#text'
    ? (node.value ?? '')
    : (node.childNodes ?? []).map(textContent).join(' ').replace(/\s+/g, ' ').trim();
  const visit = (node, currentMotionPart = '') => {
    const attrs = Object.fromEntries((node.attrs ?? []).map(attribute => [attribute.name, attribute.value]));
    const motionPart = /^BG_LAYER comp-l9pr35on1__item(?:3|4|8)$/.test(attrs['data-motion-part'] ?? '')
      ? attrs['data-motion-part']
      : currentMotionPart;
    if (node.tagName === 'a' && attrs.dataquery?.startsWith('#textLink_') && !Object.hasOwn(attrs, 'href')) {
      noHrefLabels.push({ dataquery: attrs.dataquery, text: textContent(node) });
    }
    if (node.tagName === 'a' && motionPart) {
      cardLinks.push({ motionPart, href: attrs.href, target: attrs.target });
    }
    for (const child of node.childNodes ?? []) visit(child, motionPart);
  };
  visit(parse(markup));
  assert.deepEqual(noHrefLabels, [
    { dataquery: '#textLink_kv7une7k', text: '2D Animation in The world of technology: Guides & Example' },
    { dataquery: '#textLink_ktfikio5', text: 'The Business Of Animation in Vietnam' },
    { dataquery: '#textLink_ktfik4wp', text: 'Popular types of animation in advertising' },
  ]);
  assert.deepEqual(cardLinks, [
    { motionPart: 'BG_LAYER comp-l9pr35on1__item3', href: '/deedee-studio-static/en/', target: '_self' },
    { motionPart: 'BG_LAYER comp-l9pr35on1__item4', href: '/deedee-studio-static/en/', target: '_self' },
    {
      motionPart: 'BG_LAYER comp-l9pr35on1__item8',
      href: '/deedee-studio-static/en/webinar-popular-types-animation/',
      target: '_blank',
    },
  ]);
});

test('routes the retired Vietnamese explore alias to the verified English Wix 404 target', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const root = path.resolve(import.meta.dirname, '..');
  const [blog, enBlog, explore, enExplore] = await Promise.all([
    'blog/index.html',
    'en/blog/index.html',
    'explore/index.html',
    'en/explore/index.html',
  ].map(file => readFile(path.join(root, file), 'utf8')));
  const refreshTarget = markup => markup.match(/<meta http-equiv="refresh" content="([^"]+)"/i)?.[1] ?? null;
  assert.equal(new URL(refreshTarget(blog).split('url=')[1], 'https://local.test/deedee-studio-static/blog/').pathname,
    '/deedee-studio-static/explore/');
  assert.equal(new URL(refreshTarget(enBlog).split('url=')[1], 'https://local.test/deedee-studio-static/en/blog/').pathname,
    '/deedee-studio-static/en/explore/');
  assert.equal(refreshTarget(explore), '0;url=/deedee-studio-static/en/explore/');
  assert.match(explore, /href="\/deedee-studio-static\/en\/explore\/"/);
  assert.match(enExplore, /<h1 class="error-page__code">404<\/h1>/);
});
