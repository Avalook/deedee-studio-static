/**
 * Language switch for the static mirror.
 *
 * Wix swaps the language prefix and keeps the rest of the path: /post/x <-> /en/post/x. Pages used to embed a
 * hand-made route table, so every article missing from it (all of them) fell back to the homepage.
 * Articles are written separately in each language, so most have no twin: live Wix shows a 404 there. Here they
 * go to the News page of the other language, and any other page without a twin to that language's home page.
 *
 * Wix's header is mirrored in several states: with the control, with an empty slot where it belongs, or with the
 * control but none of the script that opens it. This module opens every control and fills the empty slots.
 */
export const BASE_PATH = '/deedee-studio-static';
const ROUTE_EXCEPTIONS = new Map([
  [`${BASE_PATH}/aboutus`, `${BASE_PATH}/en/studio`],
  [`${BASE_PATH}/en/studio`, `${BASE_PATH}/aboutus`],
]);

export function normalizeLanguagePath(pathname) {
  let path = String(pathname || '/');
  try { path = decodeURI(path); } catch { /* keep the raw path */ }
  path = path.replace(/\/+$/, '');
  return path || BASE_PATH;
}

export function isEnglishPath(pathname) {
  const path = normalizeLanguagePath(pathname);
  return path === `${BASE_PATH}/en` || path.startsWith(`${BASE_PATH}/en/`);
}

/** Path of the same page in the other language. */
export function counterpartPath(pathname) {
  const path = normalizeLanguagePath(pathname);
  const exception = ROUTE_EXCEPTIONS.get(path);
  if (exception) return exception;
  if (isEnglishPath(path)) return path.slice(`${BASE_PATH}/en`.length) ? BASE_PATH + path.slice(`${BASE_PATH}/en`.length) : `${BASE_PATH}/`;
  return path === BASE_PATH ? `${BASE_PATH}/en` : `${BASE_PATH}/en${path.slice(BASE_PATH.length)}`;
}

/** Where a page without a twin sends the visitor. */
export function fallbackPath(pathname, wantsEnglish) {
  const prefix = wantsEnglish ? `${BASE_PATH}/en` : BASE_PATH;
  if (normalizeLanguagePath(pathname).includes('/post/')) return `${prefix}/news`;
  return wantsEnglish ? prefix : `${prefix}/`;
}

/** Where a click on the EN or VI option should go, or null to stay on the current page. */
export async function languageDestination({ pathname, wantsEnglish, exists }) {
  if (wantsEnglish === isEnglishPath(pathname)) return null;
  const destination = counterpartPath(pathname);
  return await exists(destination) ? destination : fallbackPath(pathname, wantsEnglish);
}

const STYLE_ID = 'deedee-language-switch-style';
const SLOT_IDS = ['comp-m73k8b651', 'comp-m7nfzsy49', 'comp-m7ovrup95'];
const SLOTS = SLOT_IDS.map(id => `[id$="_${id}"]:empty`).join(', ');
const OPEN_CLASS = 'FDTMKK';
// Some headers carry max-height: 0 on the list, so it opens with nothing to see or tap.
const STYLES = `
@media (max-width: 750px) {
  [data-testid="languages-dropdown-handle-container"].${OPEN_CLASS} [role="menu"] { top: 100% !important; bottom: auto !important; min-width: 64px; max-height: none !important; height: auto !important; overflow: visible !important; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, .15); }
  [data-testid="languages-dropdown-handle-container"].${OPEN_CLASS} [role="menuitem"] { display: flex; align-items: center; justify-content: center; height: 36px !important; min-height: 36px; }
  [data-testid="languages-dropdown-handle-container"].${OPEN_CLASS} [role="menuitem"], [data-testid="languages-dropdown-handle-container"].${OPEN_CLASS} [role="menuitem"] * { color: #000 !important; }
  [data-testid="languages-dropdown-handle-container"].${OPEN_CLASS} [role="menuitem"] svg { display: none !important; }
  [data-testid="languages-dropdown-handle-container"].${OPEN_CLASS} [role="menuitem"] > * { flex: 0 0 auto; width: auto !important; margin: 0 !important; }
}
[data-deedee-language] [data-testid="languages-dropdown-handle-container"] { position: relative; width: 100%; height: 100%; }
[data-deedee-language] [data-testid="languages-dropdown-handle"] { display: block; width: 100%; height: 100%; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-size: 16px; cursor: pointer; }
[data-deedee-language] [role="menu"] { position: absolute; top: 100%; left: 0; right: 0; z-index: 60; display: none; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, .15); }
[data-deedee-language] .${OPEN_CLASS} [role="menu"] { display: block; }
[data-deedee-language] [role="menuitem"] { display: block; width: 100%; padding: 8px 0; border: 0; background: none; color: #000; font: inherit; font-size: 16px; cursor: pointer; }
`;

function addStyles(doc) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  doc.head.append(style);
}

/** The header's own look: white over a dark hero, and the site's font on the label inside each menu link. */
function headerStyle(doc, win) {
  const shown = element => element.getBoundingClientRect().width > 0;
  const label = [...doc.querySelectorAll('nav.wixui-horizontal-menu a span')].find(shown);
  const font = label ? win.getComputedStyle(label).fontFamily : '';
  const menu = [...doc.querySelectorAll('button[aria-label="Menu"]')].find(shown);
  if (!menu) return { color: label ? win.getComputedStyle(label).color : '', font };
  // The three bars are drawn lines, so the button's own colour says nothing.
  const bars = win.getComputedStyle(menu.querySelector('path, line, rect') ?? menu);
  const color = bars.stroke && bars.stroke !== 'none' ? bars.stroke : bars.fill || bars.color;
  return { color, font };
}

export function fillEmptyLanguageSlots(doc, win, pathname) {
  const english = isEnglishPath(pathname);
  const slots = [...doc.querySelectorAll(SLOTS)];
  const { color, font } = slots.length ? headerStyle(doc, win) : {};
  for (const slot of slots) {
    slot.setAttribute('data-testid', 'language-selector-container');
    slot.setAttribute('data-deedee-language', '');
    slot.style.color = color;
    if (font) slot.style.fontFamily = font;
    slot.innerHTML = `<div data-testid="languages-dropdown-handle-container">
      <button type="button" data-testid="languages-dropdown-handle" aria-haspopup="menu" aria-expanded="false" aria-label="Language Selector: ${english ? 'English' : 'Vietnamese'}">${english ? 'EN' : 'VI'}</button>
      <div role="menu" aria-hidden="true">
        <button type="button" role="menuitem" data-testid="dropdown-option-vi">VI</button>
        <button type="button" role="menuitem" data-testid="dropdown-option-en">EN</button>
      </div>
    </div>`;
  }
  return slots.length;
}

function setOpen(handle, open) {
  const container = handle.closest('[data-testid="languages-dropdown-handle-container"]');
  handle.setAttribute('aria-expanded', String(open));
  container?.classList.toggle(OPEN_CLASS, open);
  container?.querySelector('[role="menu"]')?.setAttribute('aria-hidden', String(!open));
}

export function installLanguageSwitch(root = document, win = globalThis.window, fetchImpl = globalThis.fetch) {
  if (!win?.addEventListener || typeof fetchImpl !== 'function') return false;
  const exists = async path => {
    try {
      const response = await fetchImpl(path, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };
  const doc = root?.nodeType === 9 ? root : root?.ownerDocument;
  if (doc?.querySelectorAll) {
    addStyles(doc);
    fillEmptyLanguageSlots(doc, win, win.location.pathname);
  }
  win.addEventListener('click', async event => {
    const target = event.target;
    const option = target?.closest?.('[data-testid="dropdown-option-en"], [data-testid="dropdown-option-vi"]');
    if (option) {
      // Take over from the route table embedded in each page.
      event.stopImmediatePropagation();
      event.preventDefault();
      const wantsEnglish = option.getAttribute('data-testid') === 'dropdown-option-en';
      const destination = await languageDestination({ pathname: win.location.pathname, wantsEnglish, exists });
      if (!destination) return;
      const keepsPage = destination === counterpartPath(win.location.pathname);
      win.location.assign(keepsPage ? destination + win.location.search + win.location.hash : destination);
      return;
    }
    const handle = target?.closest?.('[data-testid="languages-dropdown-handle"]');
    if (handle) {
      event.stopImmediatePropagation();
      event.preventDefault();
      setOpen(handle, handle.getAttribute('aria-expanded') !== 'true');
      return;
    }
    doc?.querySelectorAll?.('[data-testid="languages-dropdown-handle"][aria-expanded="true"]').forEach(open => setOpen(open, false));
  }, true);
  return true;
}
