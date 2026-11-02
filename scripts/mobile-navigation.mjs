const initializedRoots = new WeakSet();

export function matchingMenuPortalId(ancestorIds, portalIds) {
  const available = new Set(portalIds);
  for (const id of ancestorIds) {
    if (typeof id !== 'string' || !id) continue;
    const portalId = `portal-${id}`;
    if (available.has(portalId)) return portalId;
  }
  return null;
}

function menuPortalFor(button, doc) {
  const component = button.closest('[data-semantic-classname="hamburger-open-button"]');
  if (!component) return null;

  const ancestorIds = [];
  for (let node = component; node; node = node.parentElement) {
    if (node.id) ancestorIds.push(node.id);
  }
  const portalIds = [...doc.querySelectorAll('[id^="portal-"]')].map(node => node.id);
  const portalId = matchingMenuPortalId(ancestorIds, portalIds);
  return portalId ? doc.getElementById(portalId) : null;
}

const MENU_STYLE_ID = 'deedee-mobile-menu-style';
// Live Wix's rows: right aligned, 58px high, a hairline between them, the current page in the site's purple.
const MENU_STYLES = `
[data-deedee-mobile-menu-content] { box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; }
[data-deedee-mobile-menu-content] nav { display: flex; flex-direction: column; width: 100%; background: #fff; border-radius: 0 0 24px 24px; overflow: hidden; }
[data-deedee-mobile-menu-content] a { box-sizing: border-box; display: flex; align-items: center; justify-content: flex-end; height: 58px; padding: 0 24px; border-top: 1px solid #dfe5ec; color: #000; font-size: 17.65px; line-height: 25px; text-decoration: none; white-space: nowrap; }
[data-deedee-mobile-menu-content] a[aria-current="page"] { color: #a033e0; }
/* The home page's own menu rules in mobile-menu-parity.css are stronger than the ones above. */
#comp-m7hggz5t1 [data-deedee-mobile-menu-content] nav > a { top: 0 !important; border-top: 1px solid #dfe5ec !important; }
#comp-m7hggz5t1 [data-deedee-mobile-menu-content] nav > a[aria-current="page"] { color: #a033e0 !important; }
`;

function populateMenuOverlay(overlay, doc) {
  // The static copy lacks Wix's runtime rule that re-enables taps under pointer-events:none containers.
  overlay.querySelectorAll('nav[data-deedee-mobile-menu]').forEach(nav => { nav.style.pointerEvents = 'auto'; });
  if (overlay.querySelector('nav.wixui-horizontal-menu, nav[data-deedee-mobile-menu]')) return true;

  const template = [...doc.querySelectorAll('nav.wixui-horizontal-menu')]
    .find(nav => !nav.closest('[data-hook="hamburger-overlay-root"]') && nav.querySelector('a[href]'));
  const content = [...overlay.querySelectorAll('[data-testid="responsive-container-content"]')].at(-1);
  if (!template || !content) return false;

  addMenuStyles(doc);
  const wrapper = doc.createElement('div');
  wrapper.setAttribute('data-deedee-mobile-menu-content', '');
  const menu = doc.createElement('nav');
  menu.setAttribute('data-deedee-mobile-menu', '');
  menu.setAttribute('aria-label', 'Site');
  menu.style.pointerEvents = 'auto';
  const links = topLevelLinks(template);
  const here = currentPath(doc.location?.pathname);
  for (const link of links) {
    const item = doc.createElement('a');
    item.setAttribute('href', link.getAttribute('href'));
    item.textContent = link.textContent.trim();
    if (currentPath(link.getAttribute('href')) === here) item.setAttribute('aria-current', 'page');
    menu.append(item);
  }
  // The site's font is set on the label inside each link, not on the link.
  const label = links[0]?.querySelector('span') ?? links[0];
  const font = label && doc.defaultView?.getComputedStyle?.(label).fontFamily;
  if (font) wrapper.style.fontFamily = font;
  wrapper.append(menu);
  const closeButton = content.querySelector('[data-semantic-classname="hamburger-close-button"]');
  content.insertBefore(wrapper, closeButton || content.firstElementChild);
  return true;
}

/** The first level only: "Career" opens a submenu on desktop, and the phone menu shows six rows. */
function topLevelLinks(template) {
  const seen = new Set();
  return [...template.querySelectorAll('a[href]')].filter(link => {
    const depth = link.closest('[data-item-depth]')?.getAttribute('data-item-depth') ?? '0';
    const href = link.getAttribute('href');
    if (depth !== '0' || seen.has(href)) return false;
    seen.add(href);
    return true;
  });
}

function currentPath(path) {
  let value = String(path ?? '');
  try { value = decodeURI(new URL(value, 'https://deedee.invalid/').pathname); } catch { /* keep the raw path */ }
  return value.replace(/\/+$/, '');
}

function addMenuStyles(doc) {
  if (!doc.head || doc.getElementById(MENU_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = MENU_STYLE_ID;
  style.textContent = MENU_STYLES;
  doc.head.append(style);
}

function setMenuState(overlay, doc, open, openerButton = null, restoreFocus = true) {
  const portalId = overlay.parentElement?.id || '';
  const ownerId = portalId.startsWith('portal-') ? portalId.slice('portal-'.length) : '';
  const opener = ownerId
    ? doc.getElementById(ownerId)?.querySelector('button[aria-label="Menu"]')
    : openerButton;

  if (open) {
    populateMenuOverlay(overlay, doc);
    if (!doc.body.hasAttribute('data-deedee-mobile-previous-overflow')) {
      doc.body.setAttribute('data-deedee-mobile-previous-overflow', doc.body.style.overflow);
    }
    doc.body.style.overflow = 'hidden';
    overlay.classList.add('HamburgerOverlay547129737--isMenuOpen');
    overlay.setAttribute('data-visible', 'true');
    opener?.setAttribute('aria-expanded', 'true');
    overlay.focus({ preventScroll: true });
    return;
  }

  overlay.classList.remove('HamburgerOverlay547129737--isMenuOpen');
  overlay.setAttribute('data-visible', 'false');
  opener?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) opener?.focus({ preventScroll: true });

  if (!doc.querySelector('[data-hook="hamburger-overlay-root"][data-visible="true"]')) {
    doc.body.style.overflow = doc.body.getAttribute('data-deedee-mobile-previous-overflow') || '';
    doc.body.removeAttribute('data-deedee-mobile-previous-overflow');
  }
}

export function installMobileNavigation(root = document) {
  if (!root?.addEventListener || initializedRoots.has(root)) return false;
  initializedRoots.add(root);
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const ElementType = doc.defaultView?.Element;

  root.addEventListener('click', event => {
    if (!ElementType || !(event.target instanceof ElementType)) return;
    const target = event.target;
    const button = target.closest('button[aria-label="Menu"][aria-haspopup="dialog"]');
    if (button) {
      const portal = menuPortalFor(button, doc);
      const overlay = portal?.querySelector('[data-hook="hamburger-overlay-root"]');
      if (!overlay) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setMenuState(overlay, doc, overlay.getAttribute('data-visible') !== 'true', button);
      return;
    }

    const closeTarget = target.closest('[data-hook="hamburger-overlay-dialog"], [aria-label="Close"]');
    const overlay = closeTarget?.closest('[data-hook="hamburger-overlay-root"]');
    if (overlay?.getAttribute('data-visible') === 'true') {
      const clickedLink = target.closest('a[href]');
      if (clickedLink) {
        // Allow the link navigation to proceed — just close the menu
        setMenuState(overlay, doc, false, null, false);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setMenuState(overlay, doc, false);
    }
  }, true);

  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const overlays = [...doc.querySelectorAll('[data-hook="hamburger-overlay-root"][data-visible="true"]')];
    if (!overlays.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    overlays.forEach(overlay => setMenuState(overlay, doc, false));
  }, true);
  return true;
}

if (typeof document !== 'undefined') installMobileNavigation();
