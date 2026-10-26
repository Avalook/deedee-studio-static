export function projectListHref(pathname) {
  const path = String(pathname || '/').split(/[?#]/, 1)[0];
  const segments = path.split('/').filter(Boolean);
  const base = segments[0] === 'deedee-studio-static' ? '/deedee-studio-static' : '';
  const routeSegments = base ? segments.slice(1) : segments;
  const locale = routeSegments[0] === 'en' ? '/en' : '';
  const projectSegment = locale ? routeSegments[1] : routeSegments[0];
  if (projectSegment !== 'all-project') return null;
  return `${base}${locale}/our-work/`;
}

export function navigateToProjectList(href, locationRef = globalThis.location) {
  if (!locationRef) return false;
  locationRef.href = href;
  return true;
}

export function installProjectDetailBack(root = document, pathname = location.pathname, navigate = navigateToProjectList) {
  const href = projectListHref(pathname);
  const back = root.getElementById?.('comp-m7r7z9pm');
  if (!href || !back) return false;

  back.setAttribute('role', 'link');
  back.setAttribute('tabindex', '0');
  back.setAttribute('aria-label', 'Back to projects');
  back.style.cursor = 'pointer';

  const activate = event => {
    if (event.type === 'keydown' && event.key !== 'Enter') return;
    if (!event.target.closest?.('#comp-m7r7z9pm')) return;
    event.preventDefault();
    navigate(href);
  };

  root.addEventListener('click', activate);
  root.addEventListener('keydown', activate);
  return true;
}
