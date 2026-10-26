import { findPhoneCountry, PHONE_COUNTRIES, phoneCountrySelection, searchPhoneCountries } from './phone-countries.mjs';

const selectorRoots = new WeakSet();

const PHONE_COUNTRY_FLAG_ASSET_BASE_URL = 'https://static.parastorage.com/services/linguist-flags/1.1005.0/assets/flags/square';

export function phoneCountryFlagAssetUrl(flag) {
  if (typeof flag !== 'string' || !/^[A-Z]{3}$/.test(flag)) return null;
  return `${PHONE_COUNTRY_FLAG_ASSET_BASE_URL}/${flag}.png`;
}

export function applyPhoneCountrySelection(trigger, country) {
  const selection = phoneCountrySelection(country);
  if (!trigger || !selection) return false;
  const doc = trigger.ownerDocument;
  if (!trigger.dataset.localCountryOriginalLabel) {
    trigger.dataset.localCountryOriginalLabel = trigger.getAttribute('aria-label') || 'Chọn mã quốc gia';
  }
  const flagUrl = phoneCountryFlagAssetUrl(selection.flag);
  let flagImage = flagUrl ? trigger.querySelector('[data-local-country-flag]') : null;
  const countryIcon = flagUrl && !flagImage ? trigger.querySelector('svg') : null;
  let code = trigger.querySelector('[data-local-country-code]');
  if (countryIcon || flagImage) {
    if (!flagImage) {
      flagImage = doc.createElement('img');
      flagImage.dataset.localCountryFlag = '';
      countryIcon.replaceWith(flagImage);
    }
    flagImage.src = flagUrl;
    flagImage.alt = '';
    flagImage.setAttribute('aria-hidden', 'true');
    flagImage.style.cssText = 'display:block;width:22.4px;height:14px;object-fit:fill;';
    code?.remove();
  } else {
    if (!code) {
      code = doc.createElement('span');
      code.setAttribute('data-local-country-code', '');
      code.style.cssText = 'margin-left:4px;white-space:nowrap;font:inherit;';
      trigger.append(code);
    }
    code.replaceChildren();
    code.textContent = selection.display;
  }
  trigger.dataset.countryName = selection.name;
  trigger.dataset.countryCode = selection.code;
  trigger.setAttribute('aria-label', `${trigger.dataset.localCountryOriginalLabel}: ${selection.label}`);
  trigger.title = selection.label;
  return true;
}

function closeCountryMenus(root, restoreFocus = false) {
  root.querySelectorAll('[data-local-country-menu]').forEach(menu => {
    const list = menu.querySelector('[role="listbox"]');
    const trigger = list && root.querySelector(`button[data-hook="country-selector-trigger"][aria-controls="${list.id}"]`);
    menu.remove();
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      if (restoreFocus) trigger.focus();
    }
  });
}

function renderCountryOptions(list, query, selectedCode = list.dataset.selectedCode || '') {
  const doc = list.ownerDocument;
  const matches = searchPhoneCountries(query, PHONE_COUNTRIES);
  list.replaceChildren();
  if (!matches.length) {
    const empty = doc.createElement('div');
    empty.setAttribute('role', 'status');
    empty.textContent = 'Không tìm thấy quốc gia';
    empty.style.cssText = 'padding:10px 14px;color:#666;';
    list.append(empty);
    return;
  }
  matches.forEach((country, index) => {
    const option = doc.createElement('button');
    option.type = 'button';
    option.id = `${list.id}-option-${index}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', country.code === selectedCode ? 'true' : 'false');
    option.setAttribute('data-local-country-option', '');
    option.dataset.countryName = country.name;
    option.dataset.countryCode = country.code;
    const flagUrl = phoneCountryFlagAssetUrl(country.flag);
    if (flagUrl) {
      const flag = doc.createElement('img');
      flag.src = flagUrl;
      flag.alt = '';
      flag.setAttribute('aria-hidden', 'true');
      flag.loading = 'lazy';
      flag.style.cssText = 'display:block;width:22.4px;height:14px;object-fit:fill;';
      option.append(flag);
    }
    const name = doc.createElement('span');
    name.textContent = country.name;
    const dialingCode = doc.createElement('span');
    dialingCode.textContent = country.code;
    option.append(name, dialingCode);
    option.style.cssText = 'display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;width:100%;gap:8px;cursor:pointer;border:0;background:#fff;color:#171717;text-align:left;padding:9px 14px;font:inherit;line-height:1.35;';
    option.addEventListener('mouseenter', () => { option.style.backgroundColor = 'rgba(0,0,0,.06)'; });
    option.addEventListener('mouseleave', () => { option.style.backgroundColor = '#fff'; });
    list.append(option);
  });
}

function openCountryMenu(root, trigger) {
  closeCountryMenus(root);
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const view = doc.defaultView;
  const rect = trigger.getBoundingClientRect();
  const listId = trigger.getAttribute('aria-controls') || `local-country-options-${Math.random().toString(36).slice(2)}`;
  const menu = doc.createElement('div');
  const search = doc.createElement('input');
  const list = doc.createElement('div');
  menu.id = `${listId}-menu`;
  menu.setAttribute('data-local-country-menu', '');
  menu.style.cssText = 'position:fixed;z-index:2147483000;box-sizing:border-box;min-width:min(300px,calc(100vw - 16px));max-width:calc(100vw - 16px);background:#fff;color:#171717;border:1px solid rgba(0,0,0,.28);box-shadow:0 4px 12px rgba(0,0,0,.18);padding:8px;';
  menu.style.left = `${Math.max(8, Math.min(rect.left, view.innerWidth - Math.max(rect.width, 300) - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(rect.bottom, view.innerHeight - 310))}px`;
  search.type = 'search';
  search.placeholder = 'Tìm quốc gia hoặc mã vùng';
  search.setAttribute('aria-label', 'Tìm quốc gia hoặc mã vùng');
  search.setAttribute('data-local-country-search', '');
  search.setAttribute('aria-controls', listId);
  search.style.cssText = 'box-sizing:border-box;width:100%;height:38px;margin:0 0 6px;padding:7px 10px;border:1px solid rgba(0,0,0,.3);border-radius:2px;font:inherit;';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Quốc gia và mã vùng');
  list.dataset.selectedCode = trigger.dataset.countryCode || '';
  list.style.cssText = 'max-height:240px;overflow:auto;overscroll-behavior:contain;';
  renderCountryOptions(list, '');
  menu.append(search, list);
  doc.body.append(menu);
  trigger.setAttribute('aria-controls', listId);
  trigger.setAttribute('aria-expanded', 'true');
  search.focus();
}

export function installPhoneCountrySelector(root = document) {
  if (!root?.addEventListener || selectorRoots.has(root)) return;
  selectorRoots.add(root);
  root.addEventListener('click', event => {
    const option = event.target.closest?.('[data-local-country-option]');
    if (option) {
      event.preventDefault();
      event.stopPropagation();
      const trigger = root.querySelector(`button[data-hook="country-selector-trigger"][aria-controls="${option.closest('[role="listbox"]')?.id}"]`);
      if (trigger) {
        const country = findPhoneCountry(option.dataset.countryName, option.dataset.countryCode);
        applyPhoneCountrySelection(trigger, country || { name: option.dataset.countryName, code: option.dataset.countryCode });
        closeCountryMenus(root, true);
      }
      return;
    }
    if (event.target.closest?.('[data-local-country-menu]')) return;
    const trigger = event.target.closest?.('button[data-hook="country-selector-trigger"]');
    if (trigger) {
      if (trigger.getAttribute('aria-expanded') === 'true') closeCountryMenus(root);
      else openCountryMenu(root, trigger);
      return;
    }
    closeCountryMenus(root);
  }, true);
  root.addEventListener('input', event => {
    const search = event.target.closest?.('[data-local-country-search]');
    if (search) {
      const list = root.querySelector(`#${search.getAttribute('aria-controls')}`);
      if (list) renderCountryOptions(list, search.value);
    }
  }, true);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && event.target.closest?.('[data-local-country-menu]')) {
      event.preventDefault();
      closeCountryMenus(root, true);
      return;
    }
    if (event.key === 'ArrowDown' && event.target.matches?.('[data-local-country-search]')) {
      event.preventDefault();
      root.querySelector('[data-local-country-option]')?.focus();
      return;
    }
    const option = event.target.closest?.('[data-local-country-option]');
    if (!option || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = [...root.querySelectorAll('[data-local-country-option]')];
    const currentIndex = options.indexOf(option);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : currentIndex + (event.key === 'ArrowDown' ? 1 : -1);
    options[Math.max(0, Math.min(options.length - 1, nextIndex))]?.focus();
  }, true);
}
