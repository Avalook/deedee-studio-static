export const FEED_CONFIGS = Object.freeze({
  activities: {
    gallerySelector: '#pro-gallery-margin-container-comp-lbkb681p',
    itemSelector: '[data-hook="item-link-wrapper"]',
    containerSelector: '#pro-gallery-container-comp-lbkb681p',
    desktopInitial: 6,
    mobileInitial: 18,
    firstBatch: 23,
    batchSize: 23,
    desktopFirstRevealAt: 500,
    responsiveInitials: [
      { minWidth: 1359, count: 6 },
      { minWidth: 959, count: 9 },
      { minWidth: 559, count: 12 },
      { minWidth: 479, count: 15 },
      { minWidth: 0, count: 18 },
    ],
    activityLayout: { columns: 3, rows: 8, columnGap: 10, rowGap: 10 },
  },
  activityCategory: {
    gallerySelector: '#pro-gallery-margin-container-pro-blog',
    itemSelector: '[data-hook="item-link-wrapper"]',
    containerSelector: '#pro-gallery-container-pro-blog',
    moveBeforeSelector: '#comp-l9papq2e',
    moveSelector: '#comp-l9pb3zzy',
    desktopInitial: 6,
    mobileInitial: 5,
    sourceTotal: 50,
    // Live adds 20, 20, then the last 10 as the reader reaches the bottom, on every width.
    desktopTotal: 50,
    mobileTotal: 50,
    responsiveCategoryMobile: true,
    mobileRowGap: 12,
    firstBatch: 20,
    batchSize: 20,
    desktopFirstRevealAt: 300,
    mobileFirstRevealAt: 500,
    // No fixed desktop heights: the grid is fluid (blog-category-grid.css), so its own rows set the height.
  },
  talk: {
    gallerySelector: '#pro-gallery-margin-container-pro-blog',
    itemSelector: '[data-hook="item-link-wrapper"]',
    containerSelector: '#pro-gallery-container-pro-blog',
    moveBeforeSelector: '#comp-l9papq2e',
    moveSelector: '#comp-l9pb3zzy',
    desktopInitial: 20,
    mobileInitial: 20,
    batchSize: 20,
    desktopHeights: [[20, 2992], [34, 5152]],
    mobileHeights: [[20, 6808], [34, 11596]],
  },
  knowledge: {
    gallerySelector: '#pro-gallery-margin-container-pro-blog',
    itemSelector: '[data-hook="item-link-wrapper"]',
    containerSelector: '#pro-gallery-container-pro-blog',
    moveBeforeSelector: '#comp-l9papq2e',
    moveSelector: '#comp-l9pb3zzy',
    desktopInitial: 20,
    mobileInitial: 20,
    batchSize: 20,
    desktopHeights: [[20, 2992], [33, 4720]],
    mobileHeights: [[20, 6808], [33, 11254]],
  },
});

export function getResponsiveGalleryHeight(width, layout, scrollbarWidth = 0) {
  const availableWidth = Math.max(0, width - scrollbarWidth);
  const totalColumnGaps = layout.columnGap * (layout.columns - 1);
  const cardWidth = Math.floor((availableWidth - totalColumnGaps) / layout.columns);
  return layout.rows * cardWidth + layout.rowGap * (layout.rows - 1);
}

export function getResponsiveActivityGalleryLayout(
  viewportWidth,
  galleryWidth,
  itemCount,
  desktopLayout = { columns: 3, columnGap: 10, rowGap: 10 },
) {
  if (galleryWidth <= 0 || itemCount <= 0) return null;

  const columns = viewportWidth <= 612 ? 1 : viewportWidth <= 767 ? 2 : desktopLayout.columns;
  const columnGap = columns === 1 ? 0 : columns === 2 ? 20 : desktopLayout.columnGap;
  const rowGap = columns <= 2 ? 20 : desktopLayout.rowGap;
  const rows = Math.ceil(itemCount / columns);
  const cardWidth = Math.floor((galleryWidth - columnGap * (columns - 1)) / columns);

  return {
    columns,
    rows,
    cardWidth,
    columnGap,
    rowGap,
    height: rows * cardWidth + rowGap * (rows - 1),
  };
}

export function getResponsiveFeedTotal(config, isMobile) {
  const sourceTotal = Math.max(0, Math.min(config.total, config.sourceTotal ?? config.total));
  const responsiveTotal = isMobile ? config.mobileTotal : config.desktopTotal;
  return Math.max(0, Math.min(sourceTotal, responsiveTotal ?? sourceTotal));
}

export function selectInitialFeedLimit(config, isMobile, viewportWidth = isMobile ? 640 : 641) {
  const responsiveProfile = config.responsiveInitials?.find(({ minWidth }) => viewportWidth >= minWidth);
  const requested = responsiveProfile?.count ?? (isMobile ? config.mobileInitial : config.desktopInitial);
  return Math.max(0, Math.min(config.total, requested));
}

export function getNextVisibleFeedLimit(currentLimit, config) {
  if (currentLimit >= config.total) return config.total;
  const requested = currentLimit < config.firstBatch
    ? config.firstBatch
    : currentLimit + config.batchSize;
  return Math.min(config.total, requested);
}

export function getProgressiveFeedMinHeight(visibleCount, breakpoints) {
  const match = breakpoints.find(([maximum]) => visibleCount <= maximum);
  return match?.[1] ?? breakpoints.at(-1)?.[1] ?? 0;
}

function hideItem(item) {
  if (Object.hasOwn(item.dataset, 'deedeeFeedDisplay')) return;
  item.dataset.deedeeFeedDisplay = item.style.display;
  item.dataset.deedeeFeedAriaHidden = item.getAttribute('aria-hidden') ?? '';
  item.dataset.deedeeFeedInert = item.hasAttribute('inert') ? 'true' : 'false';
  item.style.display = 'none';
  item.setAttribute('aria-hidden', 'true');
  item.setAttribute('inert', '');
}

function revealItem(item) {
  if (!Object.hasOwn(item.dataset, 'deedeeFeedDisplay')) return;
  item.style.display = item.dataset.deedeeFeedDisplay;
  if (item.dataset.deedeeFeedAriaHidden) item.setAttribute('aria-hidden', item.dataset.deedeeFeedAriaHidden);
  else item.removeAttribute('aria-hidden');
  if (item.dataset.deedeeFeedInert === 'true') item.setAttribute('inert', '');
  else item.removeAttribute('inert');
  delete item.dataset.deedeeFeedDisplay;
  delete item.dataset.deedeeFeedAriaHidden;
  delete item.dataset.deedeeFeedInert;
}

export function installMobileBlogCategoryNavigation(documentRef) {
  const feedRoot = documentRef?.querySelector('[data-hook="feed-page-root"]');
  const nav = documentRef?.querySelector(
    '[data-hook="blog-desktop-header-container"] nav[aria-label="Blog"]',
  );
  const categoryList = nav?.querySelector('ul');
  const existingMore = categoryList?.querySelector('[data-deedee-mobile-blog-category-more]');
  const items = Array.from(categoryList?.children ?? []);
  const currentItem = items.find((item) => item.querySelector('a[aria-current="page"]'));
  const currentLink = currentItem?.querySelector('a[aria-current="page"]');
  const allPostsItem = items.find((item) => {
    const href = item.querySelector('a')?.getAttribute('href') ?? '';
    return href.split(/[?#]/, 1)[0].replace(/\/+$/, '').endsWith('/blog');
  });

  if (!feedRoot || !nav || !categoryList || !currentItem || !currentLink || !allPostsItem || existingMore) {
    return () => {};
  }

  const originalItems = items.slice();
  const overflowItems = items.filter((item) => item !== allPostsItem && item !== currentItem);
  if (!overflowItems.length) return () => {};

  const nextAfterAllPosts = allPostsItem.nextElementSibling;
  if (currentItem !== nextAfterAllPosts) categoryList.insertBefore(currentItem, nextAfterAllPosts);

  const moreItem = documentRef.createElement('li');
  moreItem.setAttribute('data-deedee-mobile-blog-category-more', '');

  const menu = documentRef.createElement('div');
  menu.className = 'deedee-mobile-blog-category-more-menu';
  menu.setAttribute('data-deedee-mobile-blog-category-more-menu', '');

  const button = documentRef.createElement('button');
  button.type = 'button';
  const locale = documentRef.documentElement?.lang?.toLowerCase() ?? '';
  const moreLabel = locale.startsWith('en') ? 'More' : 'Khác';
  const defaultLink = allPostsItem.querySelector('a');
  button.className = `${defaultLink?.className ?? ''} deedee-mobile-blog-category-more-button`.trim();
  button.textContent = moreLabel;
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'deedee-mobile-blog-category-options');

  const options = documentRef.createElement('ul');
  options.className = `${categoryList.className ?? ''} deedee-mobile-blog-category-options`.trim();
  options.id = 'deedee-mobile-blog-category-options';
  options.setAttribute('data-deedee-mobile-blog-category-options', '');
  options.hidden = true;
  // On a phone live shows one dropdown labelled with the current category, so the list holds every other category.
  button.setAttribute('data-deedee-current-label', currentLink.textContent.trim());
  if (currentItem !== allPostsItem) {
    const allPostsOption = allPostsItem.cloneNode(true);
    allPostsOption.removeAttribute('id');
    allPostsOption.setAttribute('data-deedee-mobile-blog-category-all', '');
    options.append(allPostsOption);
  }
  overflowItems.forEach((item) => {
    item.setAttribute('data-deedee-mobile-blog-category-overflow', '');
    const option = item.cloneNode(true);
    option.removeAttribute('id');
    options.append(option);
  });

  const closeMenu = () => {
    button.setAttribute('aria-expanded', 'false');
    options.hidden = true;
  };
  const toggleMenu = (event) => {
    event.stopPropagation();
    const shouldOpen = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(shouldOpen));
    options.hidden = !shouldOpen;
  };
  let pointerActivationPending = false;
  const toggleMenuFromPointer = (event) => {
    if (pointerActivationPending) return;
    pointerActivationPending = true;
    toggleMenu(event);
  };
  const toggleMenuFromClick = (event) => {
    if (pointerActivationPending) {
      pointerActivationPending = false;
      return;
    }
    toggleMenu(event);
  };
  const clearPointerActivation = () => {
    pointerActivationPending = false;
  };
  const closeOnOutsideClick = (event) => {
    if (moreItem.contains(event.target)) return;
    clearPointerActivation();
    closeMenu();
  };
  const closeOnEscape = (event) => {
    if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
    clearPointerActivation();
    closeMenu();
    button.focus();
  };

  button.addEventListener('pointerdown', toggleMenuFromPointer);
  button.addEventListener('mousedown', toggleMenuFromPointer);
  button.addEventListener('pointercancel', clearPointerActivation);
  button.addEventListener('click', toggleMenuFromClick);
  documentRef.addEventListener('click', closeOnOutsideClick);
  documentRef.addEventListener('keydown', closeOnEscape);
  menu.append(button, options);
  moreItem.append(menu);
  categoryList.append(moreItem);
  feedRoot.setAttribute('data-deedee-mobile-blog-category-nav-ready', '');

  return () => {
    button.removeEventListener('pointerdown', toggleMenuFromPointer);
    button.removeEventListener('mousedown', toggleMenuFromPointer);
    button.removeEventListener('pointercancel', clearPointerActivation);
    button.removeEventListener('click', toggleMenuFromClick);
    documentRef.removeEventListener('click', closeOnOutsideClick);
    documentRef.removeEventListener('keydown', closeOnEscape);
    moreItem.remove();
    originalItems.forEach((item) => {
      item.removeAttribute('data-deedee-mobile-blog-category-overflow');
      categoryList.append(item);
    });
    feedRoot.removeAttribute('data-deedee-mobile-blog-category-nav-ready');
  };
}

export function installProgressiveBlogFeed(documentRef, windowRef, config) {
  const gallery = documentRef?.querySelector(config.gallerySelector);
  const items = gallery ? [...gallery.querySelectorAll(config.itemSelector)] : [];
  if (!items.length || typeof windowRef?.addEventListener !== 'function') return () => {};

  const removeMobileBlogCategoryNavigation = installMobileBlogCategoryNavigation(documentRef);
  const heightContainer = config.containerSelector && documentRef.querySelector(config.containerSelector);
  const movedSection = documentRef.querySelector(config.moveSelector);
  const beforeSection = documentRef.querySelector(config.moveBeforeSelector);
  if (movedSection && beforeSection) {
    const siblings = Array.from(beforeSection.parentElement?.children ?? []);
    const movedIndex = siblings.indexOf(movedSection);
    const beforeIndex = siblings.indexOf(beforeSection);
    const isOutOfOrder = movedSection.parentElement !== beforeSection.parentElement
      || (movedIndex >= 0 && beforeIndex >= 0 && movedIndex > beforeIndex);
    if (isOutOfOrder) beforeSection.parentElement.insertBefore(movedSection, beforeSection);
  }

  const hasFirstReveal = Number.isFinite(config.desktopFirstRevealAt)
    || Number.isFinite(config.mobileFirstRevealAt);
  const matchesMobile = () => windowRef.matchMedia?.('(max-width: 640px)').matches ?? false;
  let feedState;

  const updateGalleryHeight = () => {
    const responsiveLayout = config.responsiveActivityMobile
      ? getResponsiveActivityGalleryLayout(
        windowRef.innerWidth ?? documentRef.documentElement.clientWidth,
        gallery.clientWidth,
        items.length,
        config.activityLayout,
      )
      : null;
    const responsiveCategoryHeight = config.responsiveCategoryMobile && matchesMobile()
      ? getResponsiveGalleryHeight(gallery.clientWidth, {
        columns: 1,
        rows: feedState.visibleLimit,
        columnGap: 0,
        rowGap: config.mobileRowGap ?? 12,
      })
      : null;
    const minHeight = responsiveLayout
      ? responsiveLayout.height
      : responsiveCategoryHeight ?? (config.activityLayout
        ? getResponsiveGalleryHeight(gallery.clientWidth, config.activityLayout)
        : getProgressiveFeedMinHeight(feedState.visibleLimit, feedState.heights ?? []));
    if (config.activityLayout && gallery.style?.setProperty) {
      const cardWidth = responsiveLayout?.cardWidth ?? Math.floor(
        (gallery.clientWidth - config.activityLayout.columnGap * (config.activityLayout.columns - 1))
          / config.activityLayout.columns,
      );
      gallery.style.setProperty('--deedee-activity-card-size', `${cardWidth}px`);
      gallery.style.minHeight = `${minHeight}px`;
    }
    if (heightContainer && minHeight > 0) heightContainer.style.minHeight = `${minHeight}px`;
  };

  const applyViewport = (isMobile) => {
    const viewportWidth = windowRef.innerWidth ?? documentRef.documentElement.clientWidth;
    const total = getResponsiveFeedTotal({ ...config, total: items.length }, isMobile);
    const initialLimit = selectInitialFeedLimit({ ...config, total }, isMobile, viewportWidth);
    const firstBatch = config.firstBatch ?? (hasFirstReveal ? total : initialLimit);
    feedState = {
      isMobile,
      viewportWidth,
      total,
      visibleLimit: initialLimit,
      firstBatch,
      settings: { ...config, total, firstBatch },
      activeItems: items.slice(0, total),
      heights: isMobile ? config.mobileHeights : config.desktopHeights,
      firstBatchLoaded: initialLimit >= firstBatch,
    };
    items.forEach((item, index) => {
      if (index >= initialLimit || index >= total) hideItem(item);
      else revealItem(item);
    });
    updateGalleryHeight();
  };

  const revealTo = (nextLimit) => {
    const boundedLimit = Math.max(feedState.visibleLimit, Math.min(feedState.total, nextLimit));
    feedState.activeItems.slice(feedState.visibleLimit, boundedLimit).forEach(revealItem);
    feedState = { ...feedState, visibleLimit: boundedLimit };
    updateGalleryHeight();
  };

  const onScroll = () => {
    const firstRevealAt = feedState.isMobile
      ? config.mobileFirstRevealAt
      : config.desktopFirstRevealAt;
    const nearBottom = windowRef.scrollY + windowRef.innerHeight >= documentRef.documentElement.scrollHeight - 100;
    if (!feedState.firstBatchLoaded && Number.isFinite(firstRevealAt) && windowRef.scrollY >= firstRevealAt) {
      revealTo(feedState.firstBatch);
      feedState = { ...feedState, firstBatchLoaded: true };
    } else if (!feedState.firstBatchLoaded && !Number.isFinite(firstRevealAt) && nearBottom) {
      revealTo(feedState.firstBatch);
      feedState = { ...feedState, firstBatchLoaded: true };
    }
    if (feedState.firstBatchLoaded && nearBottom && feedState.visibleLimit < feedState.total) {
      revealTo(getNextVisibleFeedLimit(feedState.visibleLimit, feedState.settings));
    }
  };

  const onResize = () => {
    const nextIsMobile = matchesMobile();
    const nextWidth = windowRef.innerWidth ?? documentRef.documentElement.clientWidth;
    if (nextIsMobile !== feedState.isMobile || nextWidth !== feedState.viewportWidth) {
      applyViewport(nextIsMobile);
      onScroll();
    }
  };

  applyViewport(matchesMobile());
  windowRef.addEventListener('scroll', onScroll, { passive: true });
  windowRef.addEventListener('resize', onResize, { passive: true });
  onScroll();
  return () => {
    removeMobileBlogCategoryNavigation();
    windowRef.removeEventListener('scroll', onScroll);
    windowRef.removeEventListener('resize', onResize);
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const feedType = new URL(import.meta.url).searchParams.get('feed');
  const config = feedType === 'activities-vi'
    ? { ...FEED_CONFIGS.activities, responsiveActivityMobile: true }
    : FEED_CONFIGS[feedType];
  if (config) installProgressiveBlogFeed(document, window, config);
}
