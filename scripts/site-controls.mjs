import { normalizePageRoute } from './media-motion.mjs';
import './mobile-navigation.mjs';

import { PHONE_COUNTRIES, searchPhoneCountries, phoneCountrySelection } from './phone-countries.mjs';

import { installPhoneCountrySelector } from './phone-country-selector.mjs';
import { installProjectDetailBack } from './project-detail-navigation.mjs';

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

export function setProjectMoreVisibility(button, hasMore) {
  if (!button?.style || typeof hasMore !== 'boolean') return false;
  const display = hasMore ? '' : 'none';
  button.hidden = !hasMore;
  button.style.display = display;
  if (button.parentElement?.style) {
    button.parentElement.hidden = !hasMore;
    button.parentElement.style.display = display;
  }
  return true;
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
function imageFit(info) {
  const fitting = info?.fittingType ?? info?.imageData?.displayMode ?? info?.displayMode;
  return ['fill', 'fill_focal'].includes(fitting) ? 'cover' : 'contain';
}
function imagePosition(info) {
  const focal = info?.imageData?.focalPoint;
  if (Number.isFinite(focal?.x) && Number.isFinite(focal?.y)) return `${focal.x}% ${focal.y}%`;
  const align = String(info?.alignType || '').toLowerCase();
  const vertical = align.includes('top') ? 'top' : align.includes('bottom') ? 'bottom' : 'center';
  const horizontal = align.includes('left') ? 'left' : align.includes('right') ? 'right' : 'center';
  return `${horizontal} ${vertical}`;
}
export async function hydrateEmptyWixImages(root = document, basePath = '', fetchImpl = fetch) {
  const images = [...root.querySelectorAll('wow-image > img')].filter(image => !image.getAttribute('src'));
  if (!images.length) return 0;
  let manifest;
  try {
    const response = await fetchImpl(`${basePath}/manifest.json`);
    if (!response.ok) return 0;
    manifest = await response.json();
  } catch { return 0; }
  const index = indexManifestAssets(manifest);
  let hydrated = 0;
  for (const image of images) {
    const holder = image.closest('wow-image');
    let info;
    try { info = JSON.parse(holder?.getAttribute('data-image-info') || '{}'); } catch { continue; }
    const asset = selectManifestAsset(index, info?.imageData);
    if (!asset) continue;
    image.src = `${basePath}${asset}`;
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = imageFit(info);
    image.style.objectPosition = imagePosition(info);
    image.style.visibility = 'visible';
    image.style.opacity = '1';
    image.dataset.deedeeImageHydrated = 'true';
    hydrated += 1;
  }
  return hydrated;
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
const LOCAL_FORM_DROPDOWN_OPTIONS = Object.freeze({
  'Loại dự án': Object.freeze(['2D Series', '3D / Hybrid Series', 'Feature Film', 'Co-production / Co-development', 'Khác']),
  'Trạng thái dự án': Object.freeze(['Đã có kinh phí / Được phê duyệt', 'Kêu gọi tài trợ, cần báo giá để thuyết trình', 'Tìm kiếm đối tác đồng sản xuất']),
  'Thời gian dự kiến bắt đầu': Object.freeze(['Trong 3 tháng tới', 'Từ 3 - 6 tháng tới', 'Từ 6 - 12 tháng tới']),
});

const formDropdownRoots = new WeakSet();

export function formDropdownOptions(label, pathname = '') {
  const normalizedLabel = String(label || '').trim();
  const route = String(pathname);
  if (route.includes('contact-short-form')) {
    if (normalizedLabel === 'Loại dự án') {
      return ['Game cinematic / Trailer', 'Brand / Commercial animation', 'Short film', 'Proof of Concept', 'Music Video', 'Khác'];
    }
    if (normalizedLabel === 'Thời gian dự kiến bắt đầu') {
      return ['Trong 3 tháng tới', '3 - 6 tháng tới', '6 - 12 tháng tới'];
    }
  }
  return [...(LOCAL_FORM_DROPDOWN_OPTIONS[normalizedLabel] || [])];
}

function closeFormDropdowns(root) {
  root.querySelectorAll('[data-local-form-listbox]').forEach(list => list.remove());
  root.querySelectorAll('button[data-hook="dropdown-base"][aria-expanded="true"]').forEach(trigger => {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
  });
}

function openFormDropdown(root, trigger) {
  const route = root.defaultView || root.ownerDocument.defaultView;
  const options = formDropdownOptions(trigger.getAttribute('aria-label'), route?.location?.pathname || '');
  if (!options.length) return;
  closeFormDropdowns(root);
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const list = doc.createElement('div');
  const listId = trigger.getAttribute('aria-controls') || `local-form-options-${Math.random().toString(36).slice(2)}`;
  const rect = trigger.getBoundingClientRect();
  const view = doc.defaultView;
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('data-local-form-listbox', '');
  list.style.cssText = 'position:fixed;z-index:2147483000;overflow:auto;box-sizing:border-box;background:#fff;color:#171717;border:1px solid rgba(0,0,0,.28);box-shadow:0 4px 12px rgba(0,0,0,.18);padding:4px 0;max-height:240px;font:inherit;';
  list.style.left = `${Math.max(0, Math.min(rect.left, view.innerWidth - rect.width))}px`;
  list.style.top = `${Math.max(0, Math.min(rect.bottom, view.innerHeight - 240))}px`;
  list.style.width = `${rect.width}px`;
  options.forEach((label, index) => {
    const option = doc.createElement('div');
    option.id = `${listId}-option-${index}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.setAttribute('data-local-form-option', '');
    option.tabIndex = -1;
    option.textContent = label;
    option.style.cssText = 'cursor:pointer;padding:10px 16px;line-height:1.35;';
    option.addEventListener('mouseenter', () => { option.style.backgroundColor = 'rgba(0,0,0,.06)'; });
    option.addEventListener('mouseleave', () => { option.style.backgroundColor = ''; });
    list.append(option);
  });
  doc.body.append(list);
  trigger.setAttribute('aria-controls', listId);
  trigger.setAttribute('aria-expanded', 'true');
  list.querySelector('[role="option"]')?.focus();
}

export function installFormDropdowns(root = document) {
  if (!root?.addEventListener || formDropdownRoots.has(root)) return;
  formDropdownRoots.add(root);
  root.addEventListener('click', event => {
    const option = event.target.closest?.('[data-local-form-option]');
    if (option) {
      event.preventDefault();
      event.stopPropagation();
      const list = option.closest('[data-local-form-listbox]');
      const trigger = list && root.querySelector(`button[data-hook="dropdown-base"][aria-controls="${list.id}"]`);
      if (trigger) {
        const text = trigger.querySelector('[data-hook="dropdown-base-text"]');
        if (text) text.textContent = option.textContent;
        trigger.dataset.value = option.textContent;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.removeAttribute('aria-activedescendant');
        list.remove();
      }
      return;
    }
    const trigger = event.target.closest?.('button[role="combobox"][data-hook="dropdown-base"]');
    if (trigger) {
      if (trigger.getAttribute('aria-expanded') === 'true') closeFormDropdowns(root);
      else openFormDropdown(root, trigger);
      return;
    }
    closeFormDropdowns(root);
  }, true);
  root.addEventListener('keydown', event => {
    const trigger = event.target.closest?.('button[role="combobox"][data-hook="dropdown-base"]');
    if (trigger && ['Enter', ' ', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      openFormDropdown(root, trigger);
    } else if (event.key === 'Escape') {
      closeFormDropdowns(root);
    }
  }, true);
}

export function installSiteControls(root = document, pathname = location.pathname) {
  installPhoneCountrySelector(root);
  installFormDropdowns(root);
  installProjectDetailBack(root, pathname);
  root.querySelectorAll('a[aria-label="Check out our work"]').forEach(link => link.setAttribute('href', contactHref(pathname)));
  const base = pathname === '/deedee-studio-static' || pathname.startsWith('/deedee-studio-static/') ? '/deedee-studio-static' : '';
  hydrateEmptyWixImages(root, base).catch(() => {});
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
    setProjectMoreVisibility(more, next.hasMore);
  });
}

if (typeof document !== 'undefined') installSiteControls();
