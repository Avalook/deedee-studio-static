import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import {
  counterpartPath,
  fallbackPath,
  installLanguageSwitch,
  isEnglishPath,
  languageDestination,
} from '../scripts/language-switch.mjs';

const B = '/deedee-studio-static';

test('counterpart swaps the language prefix and keeps the rest of the path', () => {
  assert.equal(counterpartPath(`${B}/post/animation-la-gi/`), `${B}/en/post/animation-la-gi`);
  assert.equal(counterpartPath(`${B}/en/post/types-jobs-animation-house`), `${B}/post/types-jobs-animation-house`);
  assert.equal(counterpartPath(`${B}/our-work`), `${B}/en/our-work`);
  assert.equal(counterpartPath(`${B}/en/our-work/`), `${B}/our-work`);
  assert.equal(counterpartPath(`${B}/`), `${B}/en`);
  assert.equal(counterpartPath(`${B}/en`), `${B}/`);
  assert.equal(counterpartPath(`${B}/post/%C4%91i`), `${B}/en/post/đi`);
});

test('About us maps to the English Studio page and back', () => {
  assert.equal(counterpartPath(`${B}/aboutus`), `${B}/en/studio`);
  assert.equal(counterpartPath(`${B}/en/studio`), `${B}/aboutus`);
});

test('isEnglishPath only matches the /en section', () => {
  assert.equal(isEnglishPath(`${B}/en/news`), true);
  assert.equal(isEnglishPath(`${B}/en`), true);
  assert.equal(isEnglishPath(`${B}/enrollment`), false);
  assert.equal(isEnglishPath(`${B}/news`), false);
});

test('a page with a twin goes to it; articles without one go to News, other pages to the home page', async () => {
  const present = new Set([`${B}/en/our-work`, `${B}/our-work`]);
  const exists = async path => present.has(path);
  assert.equal(await languageDestination({ pathname: `${B}/our-work/`, wantsEnglish: true, exists }), `${B}/en/our-work`);
  assert.equal(await languageDestination({ pathname: `${B}/en/our-work`, wantsEnglish: false, exists }), `${B}/our-work`);
  assert.equal(await languageDestination({ pathname: `${B}/post/animation-la-gi`, wantsEnglish: true, exists }), `${B}/en/news`);
  assert.equal(await languageDestination({ pathname: `${B}/en/post/types-jobs-animation-house`, wantsEnglish: false, exists }), `${B}/news`);
  assert.equal(await languageDestination({ pathname: `${B}/en/webinar`, wantsEnglish: false, exists }), `${B}/`);
  assert.equal(await languageDestination({ pathname: `${B}/freefirehack-x`, wantsEnglish: true, exists }), `${B}/en`);
  assert.equal(await languageDestination({ pathname: `${B}/our-work`, wantsEnglish: false, exists }), null, 'already Vietnamese');
});

test('the fallback depends only on the page type and the wanted language', () => {
  assert.equal(fallbackPath(`${B}/post/x/`, true), `${B}/en/news`);
  assert.equal(fallbackPath(`${B}/en/post/x`, false), `${B}/news`);
  assert.equal(fallbackPath(`${B}/en/careers`, false), `${B}/`);
});

function harness(pathname, present) {
  const listeners = [];
  const assigned = [];
  const win = {
    location: { pathname, search: '?a=1', hash: '#x', assign: url => assigned.push(url) },
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
  };
  const fetchImpl = async path => ({ ok: present.has(path) });
  assert.equal(installLanguageSwitch({}, win, fetchImpl), true);
  const click = async testid => {
    let stopped = false;
    let prevented = false;
    const event = {
      target: { closest: selector => (selector.includes(testid) ? { getAttribute: () => testid } : null) },
      stopImmediatePropagation: () => { stopped = true; },
      preventDefault: () => { prevented = true; },
    };
    await listeners[0].fn(event);
    return { stopped, prevented };
  };
  return { listeners, assigned, click };
}

test('the click handler runs in the capture phase, takes over and navigates with query and hash', async () => {
  const h = harness(`${B}/our-work`, new Set([`${B}/en/our-work`]));
  assert.equal(h.listeners[0].type, 'click');
  assert.equal(h.listeners[0].capture, true);
  const result = await h.click('dropdown-option-en');
  assert.deepEqual(result, { stopped: true, prevented: true });
  assert.deepEqual(h.assigned, [`${B}/en/our-work?a=1#x`]);
});

test('switching to the language you are already on does not navigate', async () => {
  const h = harness(`${B}/en/news`, new Set());
  await h.click('dropdown-option-en');
  assert.deepEqual(h.assigned, []);
});

test('unrelated clicks are ignored', async () => {
  const h = harness(`${B}/our-work`, new Set());
  const event = { target: { closest: () => null }, stopImmediatePropagation: () => assert.fail('must not stop'), preventDefault: () => assert.fail('must not prevent') };
  await h.listeners[0].fn(event);
  assert.deepEqual(h.assigned, []);
});

test('install is skipped when there is no window or fetch', () => {
  assert.equal(installLanguageSwitch({}, null, fetch), false);
  assert.equal(installLanguageSwitch({}, { addEventListener() {} }, null), false);
});

test('a fallback drops the query, which belongs to the page left behind', async () => {
  const h = harness(`${B}/post/x`, new Set());
  await h.click('dropdown-option-en');
  assert.deepEqual(h.assigned, [`${B}/en/news`]);
});

function languageDom(body, pathname) {
  const { document, window } = parseHTML(`<!doctype html><html><head></head><body>${body}</body></html>`);
  const win = { location: { pathname, search: '', hash: '', assign() {} }, addEventListener: (type, fn) => { window.__click = fn; },
    getComputedStyle: () => ({ color: 'rgb(255, 255, 255)' }) };
  return { document, win, click: target => window.__click({ target, stopImmediatePropagation() {}, preventDefault() {} }) };
}

test('an empty header slot gets a working control for the current language', async () => {
  const f = languageDom('<div id="comp-a_r_comp-m73k8b651"></div><div id="comp-b_r_comp-m7nfzsy49"></div><div id="comp-c_r_comp-other"></div>', `${B}/en/all-project/x`);
  assert.equal(installLanguageSwitch(f.document, f.win, async () => ({ ok: true })), true);
  const controls = [...f.document.querySelectorAll('[data-testid="language-selector-container"]')];
  assert.equal(controls.length, 2);
  const handle = controls[0].querySelector('[data-testid="languages-dropdown-handle"]');
  assert.equal(handle.textContent, 'EN');
  assert.ok(f.document.querySelector('[data-testid="dropdown-option-vi"]'));
  assert.ok(f.document.getElementById('deedee-language-switch-style'), 'styles are added once');
  await f.click(handle);
  assert.equal(handle.getAttribute('aria-expanded'), 'true');
  assert.equal(controls[0].querySelector('[role="menu"]').getAttribute('aria-hidden'), 'false');
  await f.click(f.document.body);
  assert.equal(handle.getAttribute('aria-expanded'), 'false', 'a click elsewhere closes it');
});

test('a control already in the page is left alone but still opens', async () => {
  const f = languageDom(`<div id="comp-a_r_comp-m73k8b651" data-testid="language-selector-container"><div data-testid="languages-dropdown-handle-container">
    <button data-testid="languages-dropdown-handle" aria-expanded="false">VI</button><div role="menu" aria-hidden="true"></div></div></div>`, `${B}/news`);
  installLanguageSwitch(f.document, f.win, async () => ({ ok: true }));
  const handle = f.document.querySelector('[data-testid="languages-dropdown-handle"]');
  await f.click(handle);
  assert.ok(handle.closest('[data-testid="languages-dropdown-handle-container"]').classList.contains('FDTMKK'));
  assert.equal(f.document.querySelectorAll('[data-deedee-language]').length, 0);
});
