import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bakeSeo, restoreSeo, seoTags, syncSeo, routeToFile, SEO_LEDGER } from '../lib/seo-bake.mjs';
import { exportStaticSite } from '../lib/export.mjs';
import { validateSiteDocument } from '../lib/site-document.mjs';

const page = `<!DOCTYPE html><html><head><title>ABOUT US | DeeDee Studio</title><meta name="description" content="Old description"><meta property="og:title" content="ABOUT US | DeeDee Studio"><meta property="og:description" content="Old description"><meta property="og:image" content="https://static.example/old.jpg"><meta property="og:image:width" content="2500"><meta name="twitter:title" content="ABOUT US | DeeDee Studio"></head><body>x</body></html>`;

test('seo tags are escaped and cover title, description, share image and noindex', () => {
  const tags = seoTags({ title: 'A & "B" <c>', description: 'Mô tả', image: '/a.png', noindex: true }, { imageUrl: (value) => `https://site${value}` });
  assert.equal(tags.title, '<title>A &amp; "B" &lt;c&gt;</title>');
  assert.equal(tags.ogTitle, '<meta property="og:title" content="A &amp; &quot;B&quot; &lt;c&gt;">');
  assert.equal(tags.ogImage, '<meta property="og:image" content="https://site/a.png">');
  assert.equal(tags.robots, '<meta name="robots" content="noindex,nofollow">');
  assert.deepEqual(seoTags({}), {});
});

test('baking replaces existing tags, adds missing ones, never touches og:image:width, and restores exactly', () => {
  const wanted = seoTags({ title: 'Giới thiệu', description: 'Mô tả mới', image: 'https://x.test/n.jpg', noindex: true });
  const { html, originals } = bakeSeo(page, wanted);
  assert.match(html, /<title>Giới thiệu<\/title>/);
  assert.match(html, /<meta name="description" content="Mô tả mới">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/x.test\/n.jpg">/);
  assert.match(html, /<meta property="og:image:width" content="2500">/);
  assert.match(html, /<meta name="twitter:description" content="Mô tả mới">[^]*<\/head>/, "a missing tag is added to the head");
  assert.match(html, /<meta name="robots" content="noindex,nofollow"><\/head>/);
  assert.equal(originals.twDescription, null);
  assert.equal(restoreSeo(html, originals), page);
});

test('route mapping stays inside the site folder', () => {
  assert.equal(routeToFile('/out', '/'), path.join('/out', 'index.html'));
  assert.equal(routeToFile('/out', '/en/aboutus'), path.join('/out', 'en', 'aboutus', 'index.html'));
  assert.equal(routeToFile('/out', '/blog/hoạt-động'), path.join('/out', 'blog', 'hoạt-động', 'index.html'));
  for (const bad of ['*', '/../etc', '/a/%2e%2e/b', 'relative', '/a/%2F']) assert.equal(routeToFile('/out', bad), null, bad);
});

test('syncSeo bakes, keeps the captured tags across edits, and puts the page back when the SEO is removed', async (t) => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-sync-'));
  t.after(() => fs.rm(out, { recursive: true, force: true }));
  await fs.mkdir(path.join(out, 'aboutus'), { recursive: true });
  await fs.writeFile(path.join(out, 'aboutus', 'index.html'), page);
  const doc = (seo) => ({ ...validateSiteDocument({ schemaVersion: 1, pageId: '/aboutus', operations: [], insertions: [], seo }) });

  let changed = await syncSeo({ outDir: out, pages: { '/aboutus': doc({ title: 'One', description: 'First' }) } });
  assert.deepEqual(changed.sort(), [SEO_LEDGER, path.join('aboutus', 'index.html')].sort());
  let html = await fs.readFile(path.join(out, 'aboutus', 'index.html'), 'utf8');
  assert.match(html, /<title>One<\/title>/);

  // Changing and then dropping a field goes back to the captured value, not to the previous edit.
  await syncSeo({ outDir: out, pages: { '/aboutus': doc({ title: 'Two' }) } });
  html = await fs.readFile(path.join(out, 'aboutus', 'index.html'), 'utf8');
  assert.match(html, /<title>Two<\/title>/);
  assert.match(html, /<meta name="description" content="Old description">/);
  assert.equal(await syncSeo({ outDir: out, pages: { '/aboutus': doc({ title: 'Two' }) } }).then((files) => files.length), 0, 'a second identical publish changes nothing');

  changed = await syncSeo({ outDir: out, pages: {} });
  assert.equal(await fs.readFile(path.join(out, 'aboutus', 'index.html'), 'utf8'), page);
  assert.ok(changed.includes(path.join('aboutus', 'index.html')));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(out, SEO_LEDGER), 'utf8')).pages, {});

  // Pages that do not exist and the site-wide document are ignored.
  assert.deepEqual(await syncSeo({ outDir: out, pages: { '/missing': doc({ title: 'x' }), '*': { ...doc({ title: 'x' }), pageId: '*' } } }), []);
});

test('publishing a release writes the SEO into the page and lists the changed files for the commit', async (t) => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-export-'));
  t.after(() => fs.rm(out, { recursive: true, force: true }));
  await fs.mkdir(path.join(out, 'aboutus'), { recursive: true });
  await fs.writeFile(path.join(out, 'aboutus', 'index.html'), page);
  const runtime = path.join(out, 'runtime.js'); await fs.writeFile(runtime, '/* runtime */');
  const release = { revisionId: 'rev_x', siteDocument: { schemaVersion: 1, pages: { '/aboutus': validateSiteDocument({ schemaVersion: 1, pageId: '/aboutus', operations: [], insertions: [], seo: { title: 'Về DeeDee', image: '/deedee-studio-static/assets/x.png' } }) } } };
  const result = await exportStaticSite({ release, outDir: out, uploadsDir: path.join(out, 'none'), runtimeFile: runtime, siteOrigin: 'https://deedee.example' });
  assert.equal(result.seo, 1);
  assert.ok(result.files.includes('aboutus/index.html') && result.files.includes(SEO_LEDGER));
  const html = await fs.readFile(path.join(out, 'aboutus', 'index.html'), 'utf8');
  assert.match(html, /<title>Về DeeDee<\/title>/);
  assert.match(html, /og:image" content="https:\/\/deedee.example\/deedee-studio-static\/assets\/x.png"/);
  const overrides = JSON.parse(await fs.readFile(path.join(out, 'site-overrides.json'), 'utf8'));
  assert.equal(overrides.pages['/aboutus'].seo.title, 'Về DeeDee', 'a page with only an SEO edit is exported');
});
