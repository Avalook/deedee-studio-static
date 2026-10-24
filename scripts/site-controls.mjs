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
