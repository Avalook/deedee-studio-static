import assert from 'node:assert/strict';
import test from 'node:test';
import {
  counterpartPath,
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

test('destination follows live: existing twin, VI to missing EN is a 404, EN to missing VI stays', async () => {
  const present = new Set([`${B}/en/our-work`, `${B}/our-work`]);
  const exists = async path => present.has(path);
  assert.equal(await languageDestination({ pathname: `${B}/our-work/`, wantsEnglish: true, exists }), `${B}/en/our-work`);
  assert.equal(await languageDestination({ pathname: `${B}/en/our-work`, wantsEnglish: false, exists }), `${B}/our-work`);
  assert.equal(await languageDestination({ pathname: `${B}/post/animation-la-gi`, wantsEnglish: true, exists }), `${B}/en/post/animation-la-gi`);
  assert.equal(await languageDestination({ pathname: `${B}/en/post/types-jobs-animation-house`, wantsEnglish: false, exists }), null);
  assert.equal(await languageDestination({ pathname: `${B}/our-work`, wantsEnglish: false, exists }), null, 'already Vietnamese');
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
