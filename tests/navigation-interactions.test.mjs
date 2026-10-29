import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { installMobileNavigation } from '../scripts/mobile-navigation.mjs';
import { installPhoneCountrySelector } from '../scripts/phone-country-selector.mjs';

function dom(html) {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  const listeners = new Map();
  document.addEventListener = (type, fn) => listeners.set(type, fn);
  const event = (type, target, key) => {
    let prevented = false;
    listeners.get(type)?.({ target, key, preventDefault() { prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} });
    return prevented;
  };
  return { document, window, event };
}

test('mobile menu clones navigation once, locks scrolling and restores focus on close', () => {
  const f = dom(`<nav class="wixui-horizontal-menu"><a href="/aboutus">About</a></nav>
    <div id="menu-owner" data-semantic-classname="hamburger-open-button"><button aria-label="Menu" aria-haspopup="dialog">Menu</button></div>
    <div id="portal-menu-owner"><div data-hook="hamburger-overlay-root" data-visible="false" tabindex="-1"><div data-testid="responsive-container-content"><button aria-label="Close" data-semantic-classname="hamburger-close-button">Close</button></div></div></div>`);
  const button = f.document.querySelector('[aria-label="Menu"]');
  const overlay = f.document.querySelector('[data-hook="hamburger-overlay-root"]');
  const close = f.document.querySelector('[aria-label="Close"]');
  let focused = '';
  button.focus = () => { focused = 'button'; };
  overlay.focus = () => { focused = 'overlay'; };
  f.document.body.style.overflow = 'auto';
  assert.equal(installMobileNavigation(f.document), true);
  assert.equal(installMobileNavigation(f.document), false);
  assert.equal(f.event('click', button), true);
  assert.equal(overlay.getAttribute('data-visible'), 'true');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(f.document.body.style.overflow, 'hidden');
  assert.equal(focused, 'overlay');
  assert.equal(overlay.querySelector('nav a').getAttribute('href'), '/aboutus');
  f.event('click', close);
  assert.equal(overlay.getAttribute('data-visible'), 'false');
  assert.equal(f.document.body.style.overflow, 'auto');
  assert.equal(focused, 'button');
  f.event('click', button);
  assert.equal(overlay.querySelectorAll('nav').length, 1);
  assert.equal(f.event('keydown', button, 'Escape'), true);
  assert.equal(overlay.getAttribute('data-visible'), 'false');
  assert.equal(f.event('keydown', button, 'Escape'), false);
  assert.equal(f.event('keydown', button, 'Enter'), false);
  assert.equal(f.event('click', f.document.body), false);
  assert.equal(installMobileNavigation({}), false);
});

test('mobile menu keeps the static menu tappable and lets its links navigate', () => {
  const f = dom(`<nav class="wixui-horizontal-menu"><a href="/aboutus">About</a></nav>
    <div id="menu-owner" data-semantic-classname="hamburger-open-button"><button aria-label="Menu" aria-haspopup="dialog">Menu</button></div>
    <div id="portal-menu-owner"><div data-hook="hamburger-overlay-root" data-visible="false" tabindex="-1"><div data-hook="hamburger-overlay-dialog"><div data-testid="responsive-container-content"><nav data-deedee-mobile-menu><a href="/our-work/">Dự án</a></nav></div></div></div></div>`);
  const overlay = f.document.querySelector('[data-hook="hamburger-overlay-root"]');
  overlay.focus = () => {};
  installMobileNavigation(f.document);
  f.event('click', f.document.querySelector('[aria-label="Menu"]'));
  assert.equal(overlay.querySelectorAll('nav').length, 1);
  assert.equal(overlay.querySelector('nav').style.pointerEvents, 'auto');
  assert.equal(f.event('click', overlay.querySelector('a')), false);
  assert.equal(overlay.getAttribute('data-visible'), 'false');
});

test('mobile menu tolerates missing overlays without intercepting native clicks', () => {
  const f = dom('<button aria-label="Menu" aria-haspopup="dialog">Menu</button>');
  installMobileNavigation(f.document);
  assert.equal(f.event('click', f.document.querySelector('button')), false);
});

test('country selector filters countries, supports keyboard selection and closes safely', () => {
  const f = dom('<button data-hook="country-selector-trigger" aria-label="Country" data-country-code="+84"><svg></svg></button>');
  f.window.innerWidth = 390;
  f.window.innerHeight = 800;
  const trigger = f.document.querySelector('button');
  trigger.getBoundingClientRect = () => ({ left: 350, bottom: 780, width: 80 });
  let returnedFocus = false;
  trigger.focus = () => { returnedFocus = true; };
  installPhoneCountrySelector(f.document);
  installPhoneCountrySelector(f.document);
  f.event('click', trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  const menu = f.document.querySelector('[data-local-country-menu]');
  const search = menu.querySelector('input');
  const list = menu.querySelector('[role="listbox"]');
  assert.equal(menu.style.left, '82px');
  assert.equal(menu.style.top, '490px');
  assert.ok(list.children.length > 100);
  search.value = '+84';
  f.event('input', search);
  const option = list.querySelector('[role="option"]');
  assert.equal(option.dataset.countryCode, '+84');
  let optionFocused = false;
  option.focus = () => { optionFocused = true; };
  f.event('keydown', search, 'ArrowDown');
  assert.equal(optionFocused, true);
  optionFocused = false;
  for (const key of ['Home', 'End', 'ArrowUp', 'ArrowDown']) f.event('keydown', option, key);
  assert.equal(optionFocused, true);
  f.event('click', option);
  assert.equal(trigger.dataset.countryCode, '+84');
  assert.match(trigger.getAttribute('aria-label'), /\+84/);
  assert.ok(trigger.querySelector('img'));
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(returnedFocus, true);
  assert.equal(f.document.querySelector('[data-local-country-menu]'), null);
  f.event('click', trigger);
  const nextSearch = f.document.querySelector('[data-local-country-search]');
  nextSearch.value = 'not-a-real-country-xyz';
  f.event('input', nextSearch);
  assert.equal(f.document.querySelector('[role="status"]').textContent, 'Không tìm thấy quốc gia');
  f.event('keydown', nextSearch, 'Escape');
  assert.equal(f.document.querySelector('[data-local-country-menu]'), null);
  f.event('click', trigger);
  f.event('click', f.document.querySelector('[data-local-country-search]'));
  assert.ok(f.document.querySelector('[data-local-country-menu]'));
  f.event('click', trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  f.event('click', trigger);
  f.event('click', f.document.body);
  assert.equal(f.document.querySelector('[data-local-country-menu]'), null);
  f.event('input', f.document.body);
  f.event('keydown', f.document.body, 'x');
});
