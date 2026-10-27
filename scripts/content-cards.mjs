const installations = new WeakMap();
const BASE = '/deedee-studio-static';

/** Resolve supported listing pages without depending on captured Wix IDs. */
export function contentPageContext(pathname = '/') {
  const path = String(pathname).replace(/\/+$/, '') || '/';
  const basePath = path === BASE || path.startsWith(`${BASE}/`) ? BASE : '';
  const local = path.slice(basePath.length) || '/';
  const language = local === '/en' || local.startsWith('/en/') ? 'en' : 'vi';
  const route = language === 'en' ? local.slice(3) || '/' : local;
  return { basePath, language, page: ({ '/': 'home', '/news': 'news', '/our-work': 'projects' })[route] || null };
}

function routeIsSafe(item) {
  const locale = item.language === 'en' ? '/en' : '';
  const section = item.type === 'article' ? 'post' : 'all-project';
  return new RegExp(`^${locale}/${section}/[a-z0-9]+(?:-[a-z0-9]+)*/?$`).test(item.route || '');
}

/** Select public locale snapshots and never render explicit draft records. */
export function selectPublishedItems(catalog, context) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.items) || !context.page) return [];
  const eligible = catalog.items.filter(item => item && ['article', 'project'].includes(item.type)
    && item.language === context.language && item.status !== 'draft' && item.status !== 'unpublished'
    && typeof item.title === 'string' && item.title.trim() && routeIsSafe(item)
    && (context.page === 'home' ? item.featured === true : item.type === (context.page === 'news' ? 'article' : 'project')));
  const unique = [...new Map(eligible.map(item => [item.route, item])).values()];
  return unique.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

function imageUrl(value, base) {
  if (typeof value !== 'string') return '';
  if (/^\/(?!\/)[^\s<>"\\]*$/.test(value)) return base && !value.startsWith(`${base}/`) ? base + value : value;
  try { const parsed = new URL(value); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch { return ''; }
}

function element(root, tag, text = '', attrs = {}) {
  const node = root.createElement(tag); node.textContent = text;
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); return node;
}

function card(root, item, context) {
  const article = element(root, 'article', '', { class: 'cms-content-card' });
  const link = element(root, 'a', '', { href: context.basePath + item.route });
  const image = imageUrl(item.cover, context.basePath);
  if (image) link.append(element(root, 'img', '', { src: image, alt: item.title, loading: 'lazy', decoding: 'async' }));
  const copy = element(root, 'div', '', { class: 'cms-content-card-copy' });
  if (item.category) copy.append(element(root, 'p', item.category, { class: 'cms-content-card-category' }));
  copy.append(element(root, 'h3', item.title));
  if (item.summary) copy.append(element(root, 'p', item.summary, { class: 'cms-content-card-summary' }));
  if (item.publishedAt) copy.append(element(root, 'time', String(item.publishedAt).slice(0, 10), { datetime: item.publishedAt }));
  link.append(copy); article.append(link); return article;
}

function preserveSectionOrder(main, win) {
  if (!win?.getComputedStyle || !main.parentElement) return;
  const children = [...main.parentElement.children].flatMap(node => node === main ? [...main.children] : [node]);
  const apply = () => {
    const sections = children.filter(node => !node.getAttribute('data-cms-content'));
    const rows = sections.map((node, index) => {
      const row = Number.parseInt(win.getComputedStyle(node).gridRowStart, 10);
      const order = Number.isFinite(row) ? row * 10 : (index + 1) * 10;
      node.style.setProperty('--cms-flow-order', String(order));
      return node.tagName.toLowerCase() === 'section' ? order : 0;
    });
    const content = children.find(node => node.getAttribute('data-cms-content'));
    content?.style.setProperty('--cms-flow-order', String(Math.max(0, ...rows) + 5));
  };
  apply(); win.addEventListener?.('resize', apply);
}

function mount(root, items, context, win) {
  const main = root.querySelector('main'); if (!main) return false;
  const section = element(root, 'section', '', { class: 'cms-published-content', 'data-cms-content': context.page, 'aria-labelledby': 'cms-content-title' });
  const labels = context.language === 'en' ? { home: 'Latest from DeeDee', news: 'Latest news', projects: 'Latest projects' } : { home: 'Mới từ DeeDee', news: 'Bài viết mới', projects: 'Dự án mới' };
  section.append(element(root, 'h2', labels[context.page], { id: 'cms-content-title' }));
  const grid = element(root, 'div', '', { class: 'cms-content-grid' });
  items.forEach(item => grid.append(card(root, item, context))); section.append(grid);
  // Captured main elements use display:contents inside an explicitly positioned grid.
  // Opt into normal document flow only when additional content actually exists.
  main.insertBefore(section, main.children[1] || null);
  preserveSectionOrder(main, win);
  main.parentElement?.setAttribute('data-cms-content-flow', 'true');
  if (!root.getElementById('cms-content-cards-styles')) {
    const sheet = element(root, 'link', '', { id: 'cms-content-cards-styles', rel: 'stylesheet', href: `${context.basePath}/scripts/content-cards.css` });
    root.head?.append(sheet);
  }
  return true;
}

/** Load and mount additional catalog cards once, preserving all archived galleries. */
export async function installPublishedContent(root = globalThis.document, win = globalThis.window, { fetchImpl = globalThis.fetch } = {}) {
  const context = contentPageContext(win?.location?.pathname); if (!context.page || !root?.querySelector || !fetchImpl) return false;
  if (installations.has(root)) return installations.get(root);
  const installation = (async () => {
    try {
      const response = await fetchImpl(`${context.basePath}/content.json`, { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) return false;
      const items = selectPublishedItems(await response.json(), context); return items.length ? mount(root, items, context, win) : false;
    } catch { return false; /* An unavailable optional catalog must not break captured pages. */ }
  })();
  installations.set(root, installation); return installation;
}
