export const NEWS_PAGE_INDICES = Object.freeze({
  activity: Object.freeze([
    Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    Object.freeze([9, 10, 11, 12, 13, 14, 15, 16, 17]),
    Object.freeze([18, 19, 20, 21, 22, 23, 24, 25, 26]),
    Object.freeze([27, 28, 29, 30, 31, 32, 33, 34, 35]),
    Object.freeze([36, 37, 38, 39, 40, 41, 42, 43, 44]),
    Object.freeze([45, 46, 47, 48, 49]),
  ]),
  expert: Object.freeze([
    Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    Object.freeze([9, 10, 12, 13, 14, 15, 16, 17]),
    Object.freeze([18, 19, 21, 22, 23, 24, 25, 26]),
    Object.freeze([27, 28, 29, 30, 31, 32, 33]),
  ]),
  knowledge: Object.freeze([
    Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    Object.freeze([9, 10, 11, 12, 13, 14, 15, 16, 17]),
    Object.freeze([18, 19, 20, 21, 22, 23, 24, 25, 26]),
    Object.freeze([27, 28, 29, 30, 31, 32]),
  ]),
});

const TABS = Object.freeze({
  activity: Object.freeze({
    panel: '[aria-labelledby="tab-comp-m7vil34i"]',
    galleryId: 'pro-gallery-margin-container-comp-m8hjc0l3',
    archive: '../blog/categories/hoạt-động/',
  }),
  expert: Object.freeze({
    panel: '[aria-labelledby="tab-comp-m71mchwk3"]',
    galleryId: 'pro-gallery-margin-container-comp-m8hj86vd',
    archive: '../blog/categories/talk-interview/',
  }),
  knowledge: Object.freeze({
    panel: '[aria-labelledby="tab-comp-m71mchwr4"]',
    galleryId: 'pro-gallery-margin-container-comp-m8hj0fsh',
    archive: '../blog/categories/knowledge/',
  }),
});

export const NEWS_UNARCHIVED_ACTIVITY_ITEMS = Object.freeze([
  Object.freeze({
    title: 'DeeDee x MACC: Master Class With Anime Director Ito Tomohiko (2020)',
    href: '/deedee-studio-static/post/deedee-x-macc-master-class-with-anime-director-ito-tomohiko-2020/',
  }),
  Object.freeze({
    title: 'Trip 2020',
    href: '/deedee-studio-static/post/deedee-trip-2020/',
  }),
  Object.freeze({
    title: 'A Visiting From Mr. Frederic Alliod (2020)',
    href: '/deedee-studio-static/post/a-visiting-from-mr-frederic-alliod-2020/',
  }),
  Object.freeze({
    title: 'A Visiting From Mr. Phạm Quang Vinh - Director Of Kim Dong Publishing House (2020)',
    href: '/deedee-studio-static/post/a-visiting-from-mr-ph%E1%BA%A1m-quang-vinh-director-of-kim-dong-publishing-house-2020/',
  }),
  Object.freeze({
    title: 'A Visiting From Mr. Daniel Santos - Director of Sales - EMEA & APAC Of Toon Boom (2020)',
    href: '/deedee-studio-static/post/a-visiting-from-mr-daniel-santos-director-of-sales-emea-apac-of-toon-boom-2020/',
  }),
  Object.freeze({
    title: 'Asia TV Forum 2019',
    href: '/deedee-studio-static/post/deedee-attended-asia-tv-forum-market-2019/',
  }),
  Object.freeze({
    title: '21st Viet Nam Film Festival 2019',
    href: '/deedee-studio-static/post/21st-viet-nam-film-festival-2019/',
  }),
  Object.freeze({
    title: 'Golden Kite Film Festival 2019',
    href: '/deedee-studio-static/post/golden-kite-film-festival-2019-2/',
  }),
  Object.freeze({
    title: 'Khởi Nghiệp Animation',
    href: '/deedee-studio-static/post/khoi-nghiep-animation/',
  }),
  Object.freeze({
    title: 'Biệt Đội iOn Bạc anniversary',
    href: '/deedee-studio-static/post/series-hoat-hinh-viet/',
  }),
]);

export function getNewsPageCount(tab) {
  return NEWS_PAGE_INDICES[tab]?.length ?? 0;
}

export function getNewsPageIndices(tab, page, totalItems = Infinity) {
  const pages = NEWS_PAGE_INDICES[tab];
  if (!pages || !Number.isInteger(page) || page < 1) return [];
  const indices = pages[page - 1];
  if (!indices || indices.some(index => index >= totalItems)) return [];
  return [...indices];
}

export function getResponsiveNewsGalleryLayout(viewportWidth, galleryWidth, itemCount) {
  if (viewportWidth > 1100 || galleryWidth <= 0 || itemCount <= 0) return null;

  const isMobile = viewportWidth <= 600;
  const columns = isMobile ? 1 : 3;
  const columnGap = isMobile ? 0 : 30;
  const rowGap = 30;
  const cardWidth = isMobile
    ? galleryWidth
    : Math.round((galleryWidth - columnGap * (columns - 1)) / columns);
  const cardHeight = cardWidth * (9 / 16) + (isMobile ? 80 : 95);
  const rows = Math.ceil(itemCount / columns);

  return {
    width: galleryWidth,
    columns,
    cardWidth,
    cardHeight,
    columnGap,
    rowGap,
    height: rows * cardHeight + (rows - 1) * rowGap,
  };
}

export function applyResponsiveNewsGalleryLayout(gallery, cards, viewportWidth) {
  const container = gallery.parentElement;
  const galleryWidth = container?.clientWidth ?? gallery.clientWidth;
  const layout = getResponsiveNewsGalleryLayout(viewportWidth, galleryWidth, cards.length);
  if (!layout) return;

  gallery.style.width = `${layout.width}px`;
  cards.forEach((card, index) => {
    const item = card.querySelector('[data-hook="item-container"]');
    if (!item) return;
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const top = row * (layout.cardHeight + layout.rowGap);
    const left = column * (layout.cardWidth + layout.columnGap);
    const imageHeight = layout.cardWidth * (9 / 16);
    item.style.inset = `${top}px auto auto ${left}px`;
    item.style.width = `${layout.cardWidth}px`;
    item.style.height = `${layout.cardHeight}px`;

    const imageWrapper = card.querySelector('.gallery-item-wrapper');
    if (imageWrapper) {
      imageWrapper.style.width = `${layout.cardWidth}px`;
      imageWrapper.style.height = `${imageHeight}px`;
    }
    const imageContent = card.querySelector('.gallery-item-content');
    if (imageContent) {
      imageContent.style.width = `${layout.cardWidth}px`;
      imageContent.style.height = `${imageHeight}px`;
    }
    const image = card.querySelector('[data-hook="gallery-item-image-img"]');
    if (image) {
      image.style.width = `${layout.cardWidth}px`;
      image.style.height = `${imageHeight}px`;
    }
  });
}

function applyLayout(card, layoutCard, index) {
  const sourceItem = card.querySelector('[data-hook="item-container"]');
  const layoutItem = layoutCard.querySelector('[data-hook="item-container"]');
  if (!sourceItem || !layoutItem) return;
  sourceItem.setAttribute('style', layoutItem.getAttribute('style') ?? '');
  sourceItem.dataset.idx = String(index);
  card.dataset.idx = String(index);
}

function setCardLink(card, href) {
  for (const anchor of card.querySelectorAll('a')) {
    if (href) {
      anchor.setAttribute('href', href);
      anchor.removeAttribute('aria-disabled');
      anchor.removeAttribute('tabindex');
    } else {
      anchor.removeAttribute('href');
      anchor.setAttribute('aria-disabled', 'true');
      anchor.tabIndex = -1;
    }
  }
}

function createUnarchivedCard(spec, layoutCard, index) {
  const card = layoutCard.cloneNode(true);
  card.dataset.id = `unarchived-news-${index}`;
  card.dataset.idx = String(index);
  card.id = `news-unarchived-${index}`;

  const item = card.querySelector('[data-hook="item-container"]');
  if (item) {
    item.dataset.id = card.dataset.id;
    item.id = `news-unarchived-item-${index}`;
    for (const element of item.querySelectorAll('[style]')) {
      if (element.style.backgroundImage) element.style.backgroundImage = 'none';
    }
    for (const image of item.querySelectorAll('img')) {
      image.removeAttribute('src');
      image.removeAttribute('srcset');
      image.alt = '';
      image.hidden = true;
    }
  }

  const title = card.querySelector('h2');
  if (title) title.textContent = spec.title;
  setCardLink(card, spec.href);
  return card;
}

function createNumberControl(panel, number) {
  let control = panel.querySelector(`[data-hook="pagination__${number}"]`);
  if (control?.tagName === 'BUTTON') return control;

  const template = panel.querySelector('button[data-hook="pagination__1"]');
  if (!template) return null;
  const replacement = template.cloneNode(true);
  replacement.dataset.hook = `pagination__${number}`;
  replacement.textContent = String(number);
  replacement.setAttribute('aria-label', `Page ${number}`);
  replacement.removeAttribute('aria-current');
  replacement.removeAttribute('aria-disabled');
  replacement.removeAttribute('disabled');
  replacement.tabIndex = 0;
  replacement.classList.remove(
    'blog-button-color',
    'sI4Nnn',
    'blog-post-list-pagination-active',
  );
  if (control) {
    control.replaceWith(replacement);
  } else {
    const next = panel.querySelector('[data-hook="pagination__next"]');
    if (next) next.before(replacement);
  }
  return replacement;
}

function ensurePageControls(panel, pageCount) {
  for (let page = 1; page <= pageCount; page += 1) {
    createNumberControl(panel, page);
  }
}

function setPageControlState(panel, page, pageCount) {
  ensurePageControls(panel, pageCount);
  for (const control of panel.querySelectorAll('[data-hook^="pagination__"]')) {
    const hook = control.dataset.hook ?? '';
    const pageMatch = hook.match(/^pagination__(\d+)$/);
    if (pageMatch) {
      const number = Number(pageMatch[1]);
      control.hidden = number > pageCount;
      control.setAttribute('aria-label', `Page ${number}`);
      control.setAttribute('aria-current', number === page ? 'page' : 'false');
      control.setAttribute('aria-disabled', 'false');
      if ('disabled' in control) control.disabled = false;
      control.classList.toggle('blog-button-color', number === page);
      control.classList.toggle('sI4Nnn', number === page);
      control.classList.toggle('blog-post-list-pagination-active', number === page);
      control.tabIndex = 0;
      continue;
    }

    const target = hook.endsWith('__first') ? 1
      : hook.endsWith('__previous') ? page - 1
        : hook.endsWith('__next') ? page + 1
          : hook.endsWith('__last') ? pageCount : null;
    if (target === null) continue;
    const isDisabled = target < 1 || target > pageCount;
    control.hidden = pageCount < 2 && !hook.endsWith('__previous');
    control.setAttribute('role', 'button');
    control.setAttribute('aria-disabled', String(isDisabled));
    control.tabIndex = isDisabled ? -1 : 0;
    if ('disabled' in control) control.disabled = isDisabled;
  }
}

function updateGalleryHeight(gallery, cards) {
  const height = Math.ceil(cards.reduce((max, card) => {
    const item = card.querySelector('[data-hook="item-container"]');
    if (!item) return max;
    const top = Number.parseFloat(item.style.inset) || 0;
    const itemHeight = Number.parseFloat(item.style.height) || 0;
    return Math.max(max, top + itemHeight);
  }, 0));
  if (height < 1) return;
  gallery.style.height = `${height}px`;
  const container = gallery.parentElement?.id?.startsWith('pro-gallery-container-')
    ? gallery.parentElement
    : gallery.previousElementSibling;
  if (container?.id?.startsWith('pro-gallery-container-')) {
    container.style.height = `${height}px`;
  }
}

/**
 * Category archives use cropped 400x400 thumbnails; the News tabs show 16:9 cards, as live Wix does.
 * news/card-images.json (built by scripts/restore-news-card-images.mjs) maps a thumbnail to a 16:9 image of the same photo.
 */
export function wideCardImage(source, imageMap = {}) {
  const basename = source.slice(source.lastIndexOf('/') + 1);
  const wide = Object.hasOwn(imageMap, basename) ? imageMap[basename] : null;
  return wide ? source.slice(0, source.length - basename.length) + wide : source;
}

async function loadCardImageMap(fetchImpl) {
  try {
    const response = await fetchImpl(new URL('../news/card-images.json', import.meta.url));
    if (!response.ok) return {};
    const data = await response.json();
    return data && typeof data.images === 'object' && data.images ? data.images : {};
  } catch {
    return {};
  }
}

function getCardForIndex(index, archiveCards, extras, layoutCards, imageMap = {}) {
  const layoutCard = layoutCards[index % layoutCards.length];
  if (index < archiveCards.length && layoutCard) {
    const sourceCard = archiveCards[index];
    const card = layoutCard.cloneNode(true);
    const sourceImage = sourceCard.querySelector('[data-hook="gallery-item-image-img"]');
    const targetImage = card.querySelector('[data-hook="gallery-item-image-img"]');
    const sourceTitle = sourceCard.querySelector('h2');
    const targetTitle = card.querySelector('h2');
    const sourceLink = Array.from(sourceCard.querySelectorAll('a[href]'))
      .find(anchor => /\/post\//.test(anchor.getAttribute('href') ?? ''));

    if (sourceImage && targetImage) {
      const source = sourceImage.getAttribute('src');
      if (source) targetImage.setAttribute('src', wideCardImage(source, imageMap));
      targetImage.alt = sourceImage.alt;
      targetImage.hidden = false;
    }
    if (sourceTitle && targetTitle) targetTitle.textContent = sourceTitle.textContent;
    if (sourceLink) setCardLink(card, sourceLink.getAttribute('href'));

    const sourceId = sourceCard.dataset.id;
    if (sourceId) {
      card.dataset.id = sourceId;
      const item = card.querySelector('[data-hook="item-container"]');
      if (item) item.dataset.id = sourceId;
    }
    card.dataset.idx = String(index);
    return card;
  }

  const spec = extras[index - archiveCards.length];
  return spec && layoutCard ? createUnarchivedCard(spec, layoutCard, index) : null;
}

async function loadArchiveCards(config, fetchImpl, Parser) {
  const response = await fetchImpl(new URL(config.archive, import.meta.url));
  if (!response.ok) throw new Error(`Archive request failed: ${response.status}`);
  const sourceDocument = new Parser().parseFromString(await response.text(), 'text/html');
  const sourceGallery = sourceDocument.querySelector('[id^="pro-gallery-margin-container-"]');
  if (!sourceGallery) throw new Error('Archive gallery not found');
  return Array.from(sourceGallery.children)
    .filter(card => card.matches('[data-hook="item-link-wrapper"]'));
}

async function mountNewsTab({
  tab,
  config,
  document,
  fetchImpl,
  Parser,
}) {
  const panel = document.querySelector(config.panel);
  const gallery = document.getElementById(config.galleryId);
  if (!panel || !gallery) return false;

  const layoutCards = Array.from(gallery.children)
    .filter(card => card.matches('[data-hook="item-link-wrapper"]'))
    .slice(0, 9);
  if (layoutCards.length === 0) return false;

  const [archiveCards, imageMap] = await Promise.all([
    loadArchiveCards(config, fetchImpl, Parser),
    loadCardImageMap(fetchImpl),
  ]);
  const extras = tab === 'activity' ? NEWS_UNARCHIVED_ACTIVITY_ITEMS : [];
  const totalItems = archiveCards.length + extras.length;
  const pageCount = getNewsPageCount(tab);
  let currentPage = 1;

  const render = page => {
    const indices = getNewsPageIndices(tab, page, totalItems);
    if (indices.length === 0) return false;

    const cards = indices
      .map(index => getCardForIndex(index, archiveCards, extras, layoutCards, imageMap))
      .filter(Boolean);
    cards.forEach((card, index) => applyLayout(card, layoutCards[index % layoutCards.length], index));
    gallery.replaceChildren(...cards);
    applyResponsiveNewsGalleryLayout(gallery, cards, document.defaultView?.innerWidth ?? 1440);
    currentPage = page;
    setPageControlState(panel, page, pageCount);
    updateGalleryHeight(gallery, cards);
    return true;
  };

  panel.addEventListener('click', event => {
    const control = event.target.closest('[data-hook^="pagination__"]');
    if (!control || !panel.contains(control)) return;
    const hook = control.dataset.hook ?? '';
    const number = hook.match(/^pagination__(\d+)$/)?.[1];
    const target = number ? Number(number)
      : hook.endsWith('__first') ? 1
        : hook.endsWith('__previous') ? currentPage - 1
          : hook.endsWith('__next') ? currentPage + 1
            : hook.endsWith('__last') ? pageCount : null;
    if (target === null || !getNewsPageIndices(tab, target, totalItems).length) return;
    event.preventDefault();
    render(target);
  });

  document.defaultView?.addEventListener('resize', () => render(currentPage), { passive: true });
  render(1);
  return true;
}

export async function mountNewsPagination({
  document = globalThis.document,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  Parser = globalThis.DOMParser,
} = {}) {
  if (!document || !fetchImpl || !Parser) return false;
  const results = await Promise.all(Object.entries(TABS).map(([tab, config]) => (
    mountNewsTab({ tab, config, document, fetchImpl, Parser })
      .catch(() => false)
  )));
  return results.some(Boolean);
}

if (typeof document !== 'undefined') {
  mountNewsPagination();
}const ACTIVITY_PANEL = '[aria-labelledby="tab-comp-m7vil34i"]';
