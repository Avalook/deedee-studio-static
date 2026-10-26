import newsPages from './pagination-data.json' with { type: 'json' };

const PAGE_COUNT = newsPages.length;
let statusRegion;
const BASE_PATH = new URL('../', import.meta.url).pathname;
const PAGE_CLASSES = {
  active: 'KhVdjt KhVdjt blog-post-post-list-description-style-font blog-button-color sI4Nnn blog-button-color blog-post-list-pagination-active',
  link: 'KhVdjt KhVdjt blog-post-post-list-description-style-font',
  first: 'IeY3vx RcfyI6 BCQZoR',
  previous: 'acbUIp RcfyI6 BCQZoR',
  next: 'gwgQCb RcfyI6',
  last: 'gwgQCb RcfyI6',
};

export function normalizeNewsPage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= PAGE_COUNT ? page : 1;
}

export function getPaginationTarget(hook, currentPage) {
  const numberMatch = /^pagination__(\d+)$/.exec(hook);
  if (numberMatch) {
    const page = Number(numberMatch[1]);
    return page >= 1 && page <= PAGE_COUNT && page !== currentPage ? page : null;
  }

  const targets = {
    'pagination__first': 1,
    'pagination__previous': currentPage - 1,
    'pagination__next': currentPage + 1,
    'pagination__last': PAGE_COUNT,
  };
  const target = targets[hook];
  return Number.isInteger(target) && target >= 1 && target <= PAGE_COUNT ? target : null;
}

export function buildNewsPageHref(pathname, page) {
  const newsPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${newsPath}?page=${normalizeNewsPage(page)}`;
}


export function isPlainPaginationClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function makePaginationControl(current, page) {
  const hook = current.dataset.hook;
  const numberMatch = /^pagination__(\d+)$/.exec(hook);
  const number = numberMatch ? Number(numberMatch[1]) : null;
  const target = getPaginationTarget(hook, page);
  const active = number === page;
  const disabled = !active && target === null;
  const control = document.createElement(active || disabled ? 'button' : 'a');
  const key = hook.replace('pagination__', '');
  const label = number ? `Page ${number}` : {
    first: 'First page',
    previous: 'Previous page',
    next: 'Next page',
    last: 'Last page',
  }[key];

  const controlClass = (active ? PAGE_CLASSES.active : PAGE_CLASSES[key] || PAGE_CLASSES.link)
    .replace(/\sBCQZoR\b/g, '');
  control.dataset.hook = hook;
  control.setAttribute('aria-label', label);
  control.className = controlClass;
  if (number) {
    control.textContent = String(number);
  } else {
    control.innerHTML = current.innerHTML;
  }

  if (disabled) {
    control.type = 'button';
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
    if (!active) control.classList.add('BCQZoR');
  } else {
    control.href = buildNewsPageHref(window.location.pathname, target);
    control.removeAttribute('aria-disabled');
  }
  if (active) control.setAttribute('aria-current', 'page');
  return control;
}

function renderCards(page) {
  const items = newsPages[page - 1]?.items || [];
  document.querySelectorAll('[data-hook="post-list-root"]').forEach((root) => {
    const cards = root.querySelectorAll('[data-hook="post-list-item"]');
    cards.forEach((card, index) => {
      const item = items[index];
      if (!item) return;
      const href = `${BASE_PATH}${item.path.replace(/^\//, '')}`;
      card.querySelectorAll('a[href*="/post/"]').forEach((link) => {
        link.href = href;
        if (link.hasAttribute('aria-label')) link.setAttribute('aria-label', item.title);
      });
      const title = card.querySelector('[data-hook="post-title"] h2, h2');
      if (title) title.textContent = item.title;
    });
  });
}

function renderPagination(page) {
  document.querySelectorAll('[data-hook^="pagination__"]').forEach((control) => {
    control.replaceWith(makePaginationControl(control, page));
  });
}

function renderPage(page) {
  renderCards(page);
  renderPagination(page);

  if (!statusRegion) {
    statusRegion = document.createElement('p');
    statusRegion.setAttribute('role', 'status');
    statusRegion.setAttribute('aria-live', 'polite');
    statusRegion.setAttribute('aria-atomic', 'true');
    statusRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    document.body.append(statusRegion);
  }
  statusRegion.textContent = `Trang ${page} trên ${PAGE_COUNT}. ${newsPages[page - 1].items.length} bài viết.`;
}

function focusCurrentPage(root, page) {
  const control = root?.querySelector(`[data-hook="pagination__${page}"]`);
  if (control && !control.disabled) control.focus({ preventScroll: true });
}

function initNewsPagination() {
  if (!document.querySelector('[data-hook="post-list-root"]')) return;
  let currentPage = normalizeNewsPage(new URLSearchParams(window.location.search).get('page'));
  renderPage(currentPage);

  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-hook^="pagination__"]');
    if (!control || !isPlainPaginationClick(event)) return;
    const target = getPaginationTarget(control.dataset.hook, currentPage);
    if (target === null) return;
    const focusRoot = control.closest('[data-hook="post-list-root"]');
    event.preventDefault();
    currentPage = target;
    window.history.pushState({ page: currentPage }, '', buildNewsPageHref(window.location.pathname, currentPage));
    renderPage(currentPage);
    focusCurrentPage(focusRoot, currentPage);
  });

  window.addEventListener('popstate', () => {
    const activeControl = document.activeElement?.closest('[data-hook^="pagination__"]');
    const focusRoot = activeControl?.closest('[data-hook="post-list-root"]');
    currentPage = normalizeNewsPage(new URLSearchParams(window.location.search).get('page'));
    renderPage(currentPage);
    if (activeControl) focusCurrentPage(focusRoot, currentPage);
  });
}

if (typeof document !== 'undefined') initNewsPagination();
