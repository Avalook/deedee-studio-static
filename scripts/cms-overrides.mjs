/**
 * Applies the edits published from the CMS (cms/grapesjs) to the static pages.
 *
 * The archived HTML is never rewritten. site-overrides.json (written when a publisher clicks "Publish") holds the
 * approved edits per route, and scripts/cms-runtime.js (a copy of the editor's own runtime, kept identical by a
 * test) applies them when the page loads.
 */
const BASE_PATH = '/deedee-studio-static';

export function installCmsOverrides(doc = globalThis.document, win = globalThis.window) {
  if (!doc || !win?.location || win.__deedeeCmsRuntime) return false;
  const params = new URLSearchParams(win.location.search);
  // The editor iframe and token previews load the runtime themselves.
  if (params.has('cms-editor') || params.has('cmsPreviewToken')) return false;
  const path = win.location.pathname;
  const base = path === BASE_PATH || path.startsWith(`${BASE_PATH}/`) ? BASE_PATH : '';
  const script = doc.createElement('script');
  script.src = `${base}/scripts/cms-runtime.js`;
  script.defer = true;
  script.dataset.overrides = `${base}/site-overrides.json`;
  script.dataset.base = base;
  (doc.head ?? doc.documentElement).appendChild(script);
  return true;
}
