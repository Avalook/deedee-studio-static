import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { validateSiteDocument, createEmptySiteDocument, SITE_WIDE_PAGE_ID } from '../lib/site-document.mjs';
import { collectPageDocuments } from '../lib/export.mjs';
import { siteDocumentFor, withPageDocument, normalizePageIdFromUrl } from '../lib/site-pages.mjs';
import { mergeDocuments, portableSelector } from '../public/admin/document-scope.mjs';

test('the site-wide document is a valid page id of its own and is exported with the pages', () => {
  assert.equal(SITE_WIDE_PAGE_ID, '*');
  const shared = { ...createEmptySiteDocument('*'), operations: [{ selector: '#footer', text: 'Chân trang mới' }] };
  assert.equal(validateSiteDocument(shared).pageId, '*');
  assert.equal(normalizePageIdFromUrl(new URL('http://x/api/site-state?pageId=*')), '*');
  const project = withPageDocument(withPageDocument(null, shared), { ...createEmptySiteDocument('/aboutus'), operations: [{ selector: '#hero', text: 'Hi' }] });
  assert.equal(siteDocumentFor({ projectData: project }, '*').operations[0].text, 'Chân trang mới');
  assert.deepEqual(Object.keys(collectPageDocuments(project)).sort(), ['*', '/aboutus']);
  assert.throws(() => createEmptySiteDocument('**'));
});

test('merging puts the page on top of the site-wide edits, field by field', () => {
  const site = { operations: [{ selector: '#menu', color: '#111111', text: 'Menu' }, { selector: '#footer', text: 'Footer' }], insertions: [{ id: 'add_site', type: 'text' }] };
  const page = { operations: [{ selector: '#menu', color: '#ff0000' }], insertions: [{ id: 'add_page', type: 'text' }] };
  const merged = mergeDocuments(site, page, '/our-work');
  assert.equal(merged.pageId, '/our-work');
  assert.deepEqual(merged.operations.find((operation) => operation.selector === '#menu'), { selector: '#menu', color: '#ff0000', text: 'Menu' });
  assert.equal(merged.operations.find((operation) => operation.selector === '#footer').text, 'Footer');
  assert.deepEqual(merged.insertions.map((item) => item.id), ['add_site', 'add_page']);
  assert.deepEqual(mergeDocuments(null, null, '/').operations, []);
  assert.deepEqual(site.operations[0], { selector: '#menu', color: '#111111', text: 'Menu' }, 'inputs are not modified');
});

test('a published static page applies the site-wide edits and then its own', async () => {
  const html = '<html><head></head><body><main id="SITE_CONTAINER"><h1 id="hero">Old hero</h1><p id="menu">Old menu</p><p id="footer">Old footer</p></main></body></html>';
  async function run(pathname, overrides) {
    const { window, document } = parseHTML(html);
    // linkedom has no layout engine, so innerText is the text content.
    Object.defineProperty(window.Element.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });
    const location = { search: '', pathname: `/deedee-studio-static${pathname}`, origin: 'http://site.test' };
    document.currentScript = { dataset: { overrides: '/site-overrides.json', base: '/deedee-studio-static' } };
    // The runtime guards against loading twice per window; linkedom may hand back the same window.
    delete window.__deedeeCmsRuntime;
    Object.assign(window, { parent: window, location, innerWidth: 1440 });
    const context = vm.createContext({ window, document, location, Element: window.Element, Node: window.Node,
      HTMLImageElement: window.HTMLImageElement, HTMLAnchorElement: window.HTMLAnchorElement, NodeFilter: { SHOW_TEXT: 4 },
      URLSearchParams, WeakMap, Map, Promise, decodeURI, console,
      fetch: async () => ({ ok: true, json: async () => overrides }),
      getComputedStyle: () => ({ display: 'block', color: 'rgb(0,0,0)', backgroundColor: 'rgb(255,255,255)', fontSize: '16px' }) });
    vm.runInContext(await readFile(new URL('../public/cms-runtime.js', import.meta.url), 'utf8'), context);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return document;
  }
  const overrides = { version: 1, pages: {
    '*': { schemaVersion: 1, pageId: '*', operations: [{ selector: '#menu', text: 'New menu' }, { selector: '#footer', text: 'Shared footer' }], insertions: [] },
    '/aboutus': { schemaVersion: 1, pageId: '/aboutus', operations: [{ selector: '#footer', text: 'About footer' }, { selector: '#hero', text: 'New hero' }], insertions: [] },
  } };
  const about = await run('/aboutus', overrides);
  assert.equal(about.querySelector('#menu').textContent, 'New menu', 'site-wide edit reaches the page');
  assert.equal(about.querySelector('#footer').textContent, 'About footer', 'the page overrides the site-wide edit');
  assert.equal(about.querySelector('#hero').textContent, 'New hero');
  const other = await run('/our-work', overrides);
  assert.equal(other.querySelector('#menu').textContent, 'New menu');
  assert.equal(other.querySelector('#footer').textContent, 'Shared footer');
  assert.equal(other.querySelector('#hero').textContent, 'Old hero', 'a page-only edit stays on its page');
  const untouched = await run('/anything', { version: 1, pages: {} });
  assert.equal(untouched.querySelector('#menu').textContent, 'Old menu');
});

test('shared header/footer components get a selector that matches on every page', () => {
  assert.equal(portableSelector('#comp-la6iaw2f2_r_comp-m73k8b5y2 > nav:nth-of-type(1) > ul:nth-of-type(1)'), '[id$="_r_comp-m73k8b5y2"] > nav:nth-of-type(1) > ul:nth-of-type(1)');
  assert.equal(portableSelector('#comp-lq9zzx_r_comp-m73k8b5y2'), '[id$="_r_comp-m73k8b5y2"]');
  assert.equal(portableSelector('#comp-m8cfkxz1 > div'), '#comp-m8cfkxz1 > div', 'ids without a shared part are left alone');
  assert.equal(portableSelector('main > h1:nth-of-type(1)'), 'main > h1:nth-of-type(1)');
  const operation = { selector: portableSelector('#comp-abc123_r_comp-m73k8b5y2 > nav:nth-of-type(1) > a:nth-of-type(2)'), text: 'Menu' };
  assert.equal(validateSiteDocument({ ...createEmptySiteDocument('*'), operations: [operation] }).operations[0].selector, operation.selector);
  for (const bad of ['[id$="_r_comp-x"] > [id$="_r_comp-y"]', '[id$="x"]', '[id*="_r_comp-x"]', '[id$="_r_comp-x" i]']) {
    assert.throws(() => validateSiteDocument({ ...createEmptySiteDocument('*'), operations: [{ selector: bad, text: 'x' }] }), bad);
  }
});

test('a shared-component selector finds the same component on pages whose ids differ', async () => {
  const { document: a } = parseHTML('<body><div id="comp-aaa111_r_comp-m73k8b5y2"><nav><a>Home</a></nav></div></body>');
  const { document: b } = parseHTML('<body><div id="comp-bbb222_r_comp-m73k8b5y2"><nav><a>Home</a></nav></div></body>');
  const selector = portableSelector('#comp-aaa111_r_comp-m73k8b5y2 > nav:nth-of-type(1) > a:nth-of-type(1)');
  assert.ok(a.querySelector(selector));
  assert.ok(b.querySelector(selector));
});
