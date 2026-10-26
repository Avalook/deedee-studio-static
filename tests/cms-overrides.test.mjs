import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { installCmsOverrides } from '../scripts/cms-overrides.mjs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function fakeDocument() {
  const appended = [];
  return {
    appended,
    createElement: () => ({ dataset: {} }),
    head: { appendChild: node => appended.push(node) },
  };
}
const win = (pathname, search = '') => ({ location: { pathname, search } });

test('published CMS edits load through the runtime with the right base path', () => {
  const doc = fakeDocument();
  assert.equal(installCmsOverrides(doc, win('/deedee-studio-static/aboutus/')), true);
  const [script] = doc.appended;
  assert.equal(script.src, '/deedee-studio-static/scripts/cms-runtime.js');
  assert.equal(script.dataset.overrides, '/deedee-studio-static/site-overrides.json');
  assert.equal(script.dataset.base, '/deedee-studio-static');
  assert.equal(script.defer, true);
});

test('a site served from a domain root uses no prefix', () => {
  const doc = fakeDocument();
  installCmsOverrides(doc, win('/aboutus'));
  assert.equal(doc.appended[0].src, '/scripts/cms-runtime.js');
  assert.equal(doc.appended[0].dataset.base, '');
});

test('the editor, token previews and an already running runtime are left alone', () => {
  for (const [search, flag] of [['?cms-editor=1', false], ['?cmsPreviewToken=abc', false], ['', true]]) {
    const doc = fakeDocument();
    const w = win('/deedee-studio-static/', search);
    if (flag) w.__deedeeCmsRuntime = true;
    assert.equal(installCmsOverrides(doc, w), false);
    assert.equal(doc.appended.length, 0);
  }
  assert.equal(installCmsOverrides(undefined, undefined), false);
});

test('the static runtime is byte-identical to the CMS runtime', () => {
  assert.equal(read('scripts/cms-runtime.js'), read('cms/grapesjs/public/cms-runtime.js'),
    'run a CMS publish (or copy cms/grapesjs/public/cms-runtime.js to scripts/) after changing the runtime');
});

test('site-overrides.json ships valid and empty until something is published', () => {
  const overrides = JSON.parse(read('site-overrides.json'));
  assert.equal(overrides.version, 1);
  assert.equal(typeof overrides.pages, 'object');
});
