import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { validateSiteDocument } from '../lib/site-document.mjs';
import { deleteComponent, shouldDeleteComponent } from '../public/admin/component-actions.mjs';

const added = 'add_12345678-1234-1234-1234-123456789abc';
const empty = { schemaVersion: 1, pageId: '/', operations: [], insertions: [] };

test('delete actions preserve immutable undo snapshots and remove inserted component overrides', () => {
  const original = { ...empty, operations: [{ selector: '#hero', text: 'Edited' }], insertions: [{ id: added, type: 'text', text: 'New' }] };
  const deleted = deleteComponent(original, { selector: '#hero', deletable: true });
  assert.equal(deleted.operations[0].deleted, true);
  assert.equal(original.operations[0].deleted, undefined);
  const selector = `[data-cms-added="${added}"]`;
  const source = { ...deleted, operations: [...deleted.operations, { selector, width: 100 }] };
  const next = deleteComponent(source, { selector, insertionId: added, deletable: true });
  assert.equal(next.insertions.length, 0); assert.equal(next.operations.length, 1);
  assert.equal(source.insertions.length, 1);
  assert.equal(deleteComponent(source, { selector: '#SITE_CONTAINER', deletable: false }), source);
});

test('delete keyboard shortcut never consumes typing or modified keys', () => {
  const selection = { deletable: true };
  assert.equal(shouldDeleteComponent({ key: 'Delete', target: { closest: () => null } }, selection), true);
  assert.equal(shouldDeleteComponent({ key: 'Backspace', target: { closest: () => ({}) } }, selection), false);
  assert.equal(shouldDeleteComponent({ key: 'Delete', ctrlKey: true, target: {} }, selection), false);
  assert.equal(shouldDeleteComponent({ key: 'x', target: {} }, selection), false);
  assert.equal(shouldDeleteComponent({ key: 'Delete', target: {} }, null), false);
});

test('schema permits deletion tombstones but rejects root/structural deletions and nonboolean flags', () => {
  assert.equal(validateSiteDocument({ ...empty, operations: [{ selector: '#hero', deleted: true }] }).operations[0].deleted, true);
  for (const selector of ['body', 'html', '#SITE_CONTAINER', '#SITE_HEADER', '#SITE_PAGES', 'nav', 'header', 'main']) {
    assert.throws(() => validateSiteDocument({ ...empty, operations: [{ selector, deleted: true }] }));
  }
  assert.throws(() => validateSiteDocument({ ...empty, operations: [{ selector: '#hero', deleted: 'true' }] }));
});

test('runtime removes nested originals without selector drift, undo restores exact nodes, and protects roots', async () => {
  const { window, document } = parseHTML('<html><head></head><body><main id="SITE_CONTAINER"><section id="section"><p>First</p><p>Second</p></section><p id="hero">Hero</p><nav id="menu"><a>Menu</a></nav></main></body></html>');
  const messages = []; const parent = { postMessage(message) { messages.push(message); } }; const location = { search: '?cms-editor=1', pathname: '/', origin: 'http://cms.test' };
  Object.assign(window, { parent, location, innerWidth: 1440 });
  const context = vm.createContext({ window, document, location, Element: window.Element, Node: window.Node,
    HTMLImageElement: window.HTMLImageElement, HTMLAnchorElement: window.HTMLAnchorElement,
    NodeFilter: { SHOW_TEXT: 4 }, URLSearchParams, WeakMap, Map, getComputedStyle: () => ({ display: 'block', color: 'rgb(0,0,0)', backgroundColor: 'rgb(255,255,255)', fontSize: '16px' }) });
  vm.runInContext(await readFile(new URL('../public/cms-runtime.js', import.meta.url), 'utf8'), context);
  const send = (model) => {
    const event = new window.Event('message'); Object.assign(event, { source: parent, origin: location.origin,
      data: { source: 'deedee-cms-admin', type: 'set-document', document: model } }); window.dispatchEvent(event);
  };
  const first = document.querySelector('#section > p:nth-of-type(1)'); const second = document.querySelector('#section > p:nth-of-type(2)');
  const deletion = { ...empty, operations: [{ selector: '#section > p:nth-of-type(1)', deleted: true }, { selector: '#section > p:nth-of-type(2)', deleted: true }, { selector: '#section', deleted: true }, { selector: '#SITE_CONTAINER', deleted: true }, { selector: '#menu', deleted: true }] };
  send(deletion); assert.equal(document.querySelector('#section'), null); assert.ok(document.querySelector('#SITE_CONTAINER')); assert.ok(document.querySelector('#menu'));
  send(empty); assert.equal(document.querySelector('#section > p:nth-of-type(1)'), first); assert.equal(document.querySelector('#section > p:nth-of-type(2)'), second);
  send(deletion); window.dispatchEvent(new window.Event('resize')); assert.equal(document.querySelector('#section'), null);
  send({ ...empty, pageId: '/other' }); assert.equal(document.querySelector('#section'), null);
  send(empty); assert.equal(document.querySelector('#section > p:nth-of-type(2)'), second);
  send({ ...empty, operations: [{ selector: '#section > p:nth-of-type(1)', deleted: true }] });
  second.getBoundingClientRect = () => ({ width: 100, height: 20 });
  const select = new window.Event('message');
  Object.assign(select, { source: parent, origin: location.origin, data: { source: 'deedee-cms-admin', type: 'select', selector: '#section > p:nth-of-type(1)' } });
  window.dispatchEvent(select);
  assert.equal(messages.at(-1).selection.selector, '#section > p:nth-of-type(2)');
  send(empty);
  const wrapper = document.createElement('section'); wrapper.id = 'wrapper';
  wrapper.innerHTML = '<footer>Protected footer</footer><div data-cms-protected>Protected block</div>';
  document.querySelector('#SITE_CONTAINER').appendChild(wrapper);
  send({ ...empty, operations: [{ selector: '#wrapper', deleted: true }] });
  assert.ok(document.querySelector('#wrapper'));
});
