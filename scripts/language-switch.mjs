/**
 * Language switch for the static mirror.
 *
 * Wix swaps the language prefix and keeps the rest of the path: /post/x <-> /en/post/x. Pages used to embed a
 * hand-made route table, so every article missing from it (all of them) fell back to the homepage.
 * Live behaviour for a target that does not exist: a VI page switched to EN lands on a 404 page, while an EN
 * page switched to VI is redirected back to itself, so we stay put in that case.
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

/** Where a click on the EN or VI option should go, or null to stay on the current page. */
export async function languageDestination({ pathname, wantsEnglish, exists }) {
  if (wantsEnglish === isEnglishPath(pathname)) return null;
  const destination = counterpartPath(pathname);
  if (await exists(destination)) return destination;
  return wantsEnglish ? destination : null;
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
  win.addEventListener('click', async event => {
    const option = event.target?.closest?.('[data-testid="dropdown-option-en"], [data-testid="dropdown-option-vi"]');
    if (!option) return;
    // Take over from the route table embedded in each page.
    event.stopImmediatePropagation();
    event.preventDefault();
    const wantsEnglish = option.getAttribute('data-testid') === 'dropdown-option-en';
    const destination = await languageDestination({ pathname: win.location.pathname, wantsEnglish, exists });
    if (destination) win.location.assign(destination + win.location.search + win.location.hash);
  }, true);
  void root;
  return true;
}
