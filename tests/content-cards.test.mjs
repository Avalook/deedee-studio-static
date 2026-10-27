import test from 'node:test';
import assert from 'node:assert/strict';
import { contentPageContext, selectPublishedItems, installPublishedContent } from '../scripts/content-cards.mjs';

const item = (changes = {}) => ({ id: 'one', type: 'article', language: 'vi', slug: 'new-story',
  route: '/post/new-story/', title: 'Bài viết mới', summary: 'Tóm tắt', cover: '/assets/cms/test.webp',
  featured: true, publishedAt: '2026-10-27', category: 'Hoạt động', ...changes });

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.textContent = ''; this.styles = {}; this.style = { setProperty: (name, value) => { this.styles[name] = value; } }; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name]; }
  append(...nodes) { for (const n of nodes) { n.parentElement = this; this.children.push(n); } }
  insertBefore(node, target) { node.parentElement = this; const at = this.children.indexOf(target); this.children.splice(at < 0 ? this.children.length : at, 0, node); }
}

function fixture() {
  const parent = new Element('div'); const main = new Element('main');
  parent.append(main); main.append(new Element('section'), new Element('section'));
  const head = new Element('head'); const root = { head, main,
    createElement: tag => new Element(tag), querySelector: selector => selector.startsWith('main') ? main : null,
    getElementById: id => head.children.find(c => c.attrs.id === id) || null,
  };
  return { root, parent, main, head };
}

const all = node => [node, ...(node.children || []).flatMap(all)];

test('page context recognizes locales and project base without matching arbitrary pages', () => {
  assert.deepEqual(contentPageContext('/deedee-studio-static/en/news/'), { basePath: '/deedee-studio-static', language: 'en', page: 'news' });
  assert.equal(contentPageContext('/en').page, 'home');
  assert.equal(contentPageContext('/our-work/').page, 'projects');
  assert.equal(contentPageContext('/post/news/').page, null);
  assert.equal(contentPageContext('/deedee-studio-static').page, 'home');
});

test('catalog selection filters locale/type/featured, sorts and rejects draft or unsafe routes', () => {
  const catalog = { version: 1, items: [item(), item(), item({ id: 'two', route: '/post/older/', publishedAt: '2025-01-01' }),
    item({ id: 'draft', status: 'draft', route: '/post/draft/' }), item({ id: 'en', language: 'en', route: '/en/post/english/' }),
    item({ id: 'project', type: 'project', route: '/all-project/new-film/' }), item({ id: 'evil', route: 'javascript:evil' }),
    item({ id: 'hidden', featured: false, route: '/post/not-featured/' })] };
  assert.deepEqual(selectPublishedItems(catalog, contentPageContext('/')).map(x => x.id), ['one', 'project', 'two']);
  assert.deepEqual(selectPublishedItems(catalog, contentPageContext('/news')).map(x => x.id), ['one', 'hidden', 'two']);
  assert.deepEqual(selectPublishedItems(catalog, contentPageContext('/en/news')).map(x => x.id), ['en']);
  assert.deepEqual(selectPublishedItems(catalog, contentPageContext('/our-work')).map(x => x.id), ['project']);
  assert.deepEqual(selectPublishedItems({ items: [] }, contentPageContext('/')), []);
});

test('installs isolated safe cards once without changing original gallery children', async () => {
  const { root, parent, main, head } = fixture(); const originals = [...main.children]; let fetches = 0;
  const win = { location: { pathname: '/deedee-studio-static/news/' } };
  const fetchImpl = async url => { fetches++; assert.equal(url, '/deedee-studio-static/content.json'); return { ok: true, json: async () => ({ version: 1, items: [item({ title: '<script>evil</script>' })] }) }; };
  assert.equal(await installPublishedContent(root, win, { fetchImpl }), true);
  assert.equal(await installPublishedContent(root, win, { fetchImpl }), true);
  assert.equal(fetches, 1); assert.equal(main.children[0], originals[0]); assert.equal(main.children[2], originals[1]);
  assert.equal(parent.attrs['data-cms-content-flow'], 'true'); assert.equal(head.children.length, 1);
  const nodes = all(main.children[1]);
  assert.ok(nodes.some(n => n.tagName === 'h3' && n.textContent === '<script>evil</script>'));
  assert.ok(nodes.some(n => n.tagName === 'a' && n.attrs.href === '/deedee-studio-static/post/new-story/'));
  assert.ok(nodes.some(n => n.tagName === 'img' && n.attrs.src === '/deedee-studio-static/assets/cms/test.webp'));
  assert.ok(nodes.some(n => n.tagName === 'time' && n.attrs.datetime === '2026-10-27'));
});

test('missing/failed catalogs and unrelated routes leave archived page untouched', async () => {
  for (const fetchImpl of [async () => ({ ok: false, status: 404 }), async () => { throw new Error('network'); }, async () => ({ ok: true, json: async () => ({ version: 1, items: [] }) })]) {
    const { root, main, parent } = fixture();
    assert.equal(await installPublishedContent(root, { location: { pathname: '/news' } }, { fetchImpl }), false);
    assert.equal(main.children.length, 2); assert.equal(parent.attrs['data-cms-content-flow'], undefined);
  }
  const { root } = fixture();
  assert.equal(await installPublishedContent(root, { location: { pathname: '/aboutus' } }, { fetchImpl: () => { throw new Error('should not fetch'); } }), false);
});

test('preserves responsive grid visual order when mobile header occurs after content in DOM', async () => {
  const { root, main, parent } = fixture();
  const header = new Element('header'); const footer = new Element('footer');
  parent.insertBefore(header, main); parent.append(footer);
  const [listing, mobileHeader] = main.children;
  const rows = new Map([[header, '1'], [listing, '4'], [mobileHeader, '2'], [footer, '5']]);
  let resize;
  const win = { location: { pathname: '/news' }, getComputedStyle: node => ({ gridRowStart: rows.get(node) || 'auto' }), addEventListener: (_type, handler) => { resize = handler; } };
  await installPublishedContent(root, win, { fetchImpl: async () => ({ ok: true, json: async () => ({ version: 1, items: [item()] }) }) });
  const added = main.children.find(node => node.attrs['data-cms-content']);
  assert.equal(header.styles['--cms-flow-order'], '10');
  assert.equal(mobileHeader.styles['--cms-flow-order'], '20');
  assert.equal(listing.styles['--cms-flow-order'], '40');
  assert.equal(added.styles['--cms-flow-order'], '45');
  assert.equal(footer.styles['--cms-flow-order'], '50');
  rows.set(mobileHeader, '1'); resize();
  assert.equal(mobileHeader.styles['--cms-flow-order'], '10');
});
