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

function populateMenuOverlay(overlay, doc) {
  if (overlay.querySelector('nav.wixui-horizontal-menu')) return true;

  const template = [...doc.querySelectorAll('nav.wixui-horizontal-menu')]
    .find(nav => !nav.closest('[data-hook="hamburger-overlay-root"]') && nav.querySelector('a[href]'));
  const content = [...overlay.querySelectorAll('[data-testid="responsive-container-content"]')].at(-1);
  if (!template || !content) return false;

  const wrapper = doc.createElement('div');
  wrapper.setAttribute('data-deedee-mobile-menu-content', '');
  wrapper.style.cssText = 'box-sizing:border-box;width:100%;min-width:0;max-width:100%;';
  const menu = template.cloneNode(true);
  menu.style.setProperty('width', '100%', 'important');
  menu.style.setProperty('max-width', '100%', 'important');
  wrapper.append(menu);
  const closeButton = content.querySelector('[data-semantic-classname="hamburger-close-button"]');
  content.insertBefore(wrapper, closeButton || content.firstElementChild);
  return true;
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
