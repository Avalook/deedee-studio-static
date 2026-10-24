import { normalizePageRoute } from './media-motion.mjs';

export function contactHref(pathname) {
  const path = String(pathname || '/');
  const base = path.startsWith('/deedee-studio-static/') ? '/deedee-studio-static' : '';
  const locale = /(?:^|\/)en(?:\/|$)/.test(path) ? '/en' : '';
  return `${base}${locale}/contact-us/`;
}
export function projectPage(items, count, batch) {
  if (!Array.isArray(items) || !Number.isInteger(count) || count < 0 || !Number.isInteger(batch) || batch < 1) throw new Error('Invalid pagination values');
  const next = Math.min(items.length, count + batch);
  return { items: items.slice(0, next), count: next, hasMore: next < items.length };
}
export function validateProjectData(data) {
  if (!data || !Array.isArray(data.pages)) throw new Error('Invalid project data');
  const pages = data.pages.map(page => {
    if (!page || typeof page.route !== 'string' || !/^\/(?:en\/)?our-work$/.test(page.route) || !Array.isArray(page.items) || !Number.isInteger(page.pageSize) || page.pageSize < 1 || typeof page.panel !== 'string' || typeof page.repeatId !== 'string' || typeof page.buttonId !== 'string') throw new Error('Invalid project data');
    for (const markup of page.items) {
      if (typeof markup !== 'string' || /<\s*(?:script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript\s*:/i.test(markup)) throw new Error('Invalid project data');
    }
    return page;
  });
  return pages;
}
export function indexManifestAssets(manifest) {
  const index = new Map();
  for (const [url, asset] of Object.entries(manifest?.assets || {})) {
    if (!/^\/assets\/[a-zA-Z0-9._-]+$/.test(asset)) continue;
    let parsed;
    try { parsed = new URL(url); } catch { continue; }
    if (parsed.hostname !== 'static.wixstatic.com') continue;
    const path = decodeURIComponent(parsed.pathname);
    const match = path.match(/^\/media\/([^/]+)(\/v1\/.*)?$/);
    if (!match) continue;
    const uri = match[1];
    const transform = match[2] || '';
    if (!index.has(uri)) index.set(uri, { direct: null, variants: [] });
    const entry = index.get(uri);
    if (!transform) { entry.direct = asset; continue; }
    const width = Number((transform.match(/(?:^|[/,])w_(\d+)/) || [])[1]) || 0;
    const height = Number((transform.match(/(?:^|[/,])h_(\d+)/) || [])[1]) || 0;
    entry.variants.push({ width, height, asset });
  }
  return index;
}
export function selectManifestAsset(index, imageData) {
  const entry = index.get(imageData?.uri);
  if (!entry) return null;
  if (entry.direct) return entry.direct;
  const width = Number(imageData?.width) || 0;
  const height = Number(imageData?.height) || 0;
  const exact = entry.variants.filter(item => item.width === width && item.height === height);
  // imageData can declare the original size while the mirror only has smaller derivatives.
  const candidates = exact.length ? exact : entry.variants;
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => (b.width * b.height - a.width * a.height) || a.asset.localeCompare(b.asset))[0].asset;
}

function hydrateWixImage(image, index, basePath) {
  const holder = image.closest('wow-image');
  let info;
  try { info = JSON.parse(holder?.getAttribute('data-image-info') || '{}'); } catch { return false; }
  const asset = selectManifestAsset(index, info?.imageData);
  if (!asset) return false;
  image.src = `${basePath}${asset}`;
  image.style.width = '100%';
  image.style.height = '100%';
  image.style.objectFit = info.displayMode === 'fill' ? 'cover' : 'contain';
  image.style.objectPosition = 'center center';
  image.style.visibility = 'visible';
  image.style.opacity = '1';
  image.dataset.deedeeImageHydrated = 'true';
  return true;
}

function hydrateWixImages(images, index, basePath) {
  let hydrated = 0;
  for (const image of images) {
    if (hydrateWixImage(image, index, basePath)) hydrated += 1;
  }
  return hydrated;
}


function createManifestIndexLoader(basePath, fetchImpl) {
  let manifestPromise;
  return () => {
    if (!manifestPromise) {
      manifestPromise = (async () => {
        try {
          const response = await fetchImpl(`${basePath}/manifest.json`);
          if (!response.ok) return null;
          return indexManifestAssets(await response.json());
        } catch {
          return null;
        }
      })().then(index => {
        if (!index) manifestPromise = null;
        return index;
      });
    }
    return manifestPromise;
  };
}

async function hydrateIntersectingWixImages(entries, observer, pendingImages, loadIndex, basePath) {
  const eligible = entries
    .filter(entry => entry.isIntersecting || entry.intersectionRatio > 0)
    .map(entry => entry.target)
    .filter(image => !image.getAttribute('src') && !pendingImages.has(image));
  if (!eligible.length) return;
  eligible.forEach(image => pendingImages.add(image));

  const index = await loadIndex();
  if (!index) {
    eligible.forEach(image => pendingImages.delete(image));
    return;
  }
  for (const image of eligible) {
    if (!image.getAttribute('src')) hydrateWixImage(image, index, basePath);
    observer.unobserve(image);
  }
}


function findNearViewportImages(images, viewportHeight, margin) {
  return images.filter(image => {
    if (image.getAttribute('src')) return false;
    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
  });
}
export async function hydrateEmptyWixImages(root = document, basePath = '', fetchImpl = fetch, candidates = null) {
  const images = candidates || [...root.querySelectorAll('wow-image > img')]
    .filter(image => !image.getAttribute('src'));
  if (!images.length) return 0;
  let manifest;
  try {
    const response = await fetchImpl(`${basePath}/manifest.json`);
    if (!response.ok) return 0;
    manifest = await response.json();
  } catch { return 0; }
  return hydrateWixImages(images, indexManifestAssets(manifest), basePath);
}


export function observeEmptyWixImages(
  root = document,
  basePath = '',
  fetchImpl = fetch,
  ObserverImpl = globalThis.IntersectionObserver,
  windowImpl = globalThis.window,
) {
  const images = [...root.querySelectorAll('wow-image > img')]
    .filter(image => !image.getAttribute('src'));
  if (!images.length) return null;
  if (typeof ObserverImpl !== 'function') {
    hydrateEmptyWixImages(root, basePath, fetchImpl).catch(() => {});
    return null;
  }

  const pendingImages = new WeakSet();
  const loadIndex = createManifestIndexLoader(basePath, fetchImpl);
  const hydrate = entries => hydrateIntersectingWixImages(
    entries,
    observer,
    pendingImages,
    loadIndex,
    basePath,
  );
  let observer;
  observer = new ObserverImpl(
    entries => hydrate(entries),
    { rootMargin: '1200px 0px' },
  );
  images.forEach(image => observer.observe(image));

  if (typeof windowImpl?.addEventListener === 'function') {
    let scheduled = false;
    const checkNearViewport = () => {
      scheduled = false;
      const near = findNearViewportImages(images, windowImpl.innerHeight, 1200);
      if (near.length) {
        hydrate(near.map(target => ({ target, isIntersecting: true })));
      }
    };
    const scheduleCheck = () => {
      if (scheduled) return;
      scheduled = true;
      if (typeof windowImpl.requestAnimationFrame === 'function') {
        windowImpl.requestAnimationFrame(checkNearViewport);
      } else {
        setTimeout(checkNearViewport, 0);
      }
    };
    windowImpl.addEventListener('resize', scheduleCheck, { passive: true });
    windowImpl.addEventListener('scroll', scheduleCheck, { passive: true });
    scheduleCheck();
  }

  return observer;
}
export async function loadProjectData(fetchImpl = fetch, url = '/deedee-studio-static/project-pages.json') {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Project data HTTP ${response.status}`);
  return validateProjectData(await response.json());
}
export function toggleTestimonial(button) {
  const text = button?.closest?.('[data-testid="repeater-item"], [role="listitem"]')?.querySelector?.('.iwXk2R');
  if (!text) return false;
  const expanded = button.getAttribute('aria-expanded') === 'true';
  text.classList.toggle('iwXk2R', expanded);
  button.setAttribute('aria-expanded', String(!expanded));
  button.textContent = expanded ? 'Show More' : 'Show Less';
  return true;
}
export function installSiteControls(root = document, pathname = location.pathname) {
  root.querySelectorAll('a[aria-label="Check out our work"]').forEach(link => link.setAttribute('href', contactHref(pathname)));
  const base = pathname === '/deedee-studio-static' || pathname.startsWith('/deedee-studio-static/') ? '/deedee-studio-static' : '';
  observeEmptyWixImages(root, base);
  root.addEventListener('click', async event => {
    const testimonial = event.target.closest?.('button[data-testid="ellipsis_text_viewer_expand_control"]');
    if (testimonial && toggleTestimonial(testimonial)) { event.preventDefault(); return; }
    const more = event.target.closest?.('[data-testid="buttonElement"]');
    if (!more || !/show more|xem thêm/i.test(more.getAttribute('aria-label') || more.textContent)) return;
    const current = normalizePageRoute(pathname);
    event.preventDefault();
    const data = await loadProjectData();
    const page = data.find(item => item.route === current && item.buttonId === more.parentElement?.id);
    const list = page && root.getElementById(page.repeatId)?.querySelector(`[data-testid="responsive-container-content"]`);
    if (!page || !list) return;
    const next = projectPage(page.items, list.querySelectorAll('[role="listitem"]').length, page.pageSize);
    const fragment = root.createDocumentFragment();
    next.items.slice(list.querySelectorAll('[role="listitem"]').length).forEach(html => {
      const template = root.createElement('template'); template.innerHTML = html; fragment.append(template.content);
    });
    list.append(fragment);
    more.hidden = !next.hasMore;
  });
}

if (typeof document !== 'undefined') installSiteControls();
