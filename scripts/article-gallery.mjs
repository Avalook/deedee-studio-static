const IMAGE_VIEWER_SELECTOR = '[data-hook="image-viewer"]';
const GALLERY_ROOT_ID = 'deedee-article-gallery';
const installedRoots = new WeakSet();

function articleImageItem(viewer) {
  const image = viewer.querySelector('img');
  const src = image?.currentSrc || image?.getAttribute('src') || image?.src || '';
  return src ? { src, alt: image?.getAttribute('alt') || image?.alt || '' } : null;
}

export function collectArticleGalleryItems(root = document) {
  return [...root.querySelectorAll(IMAGE_VIEWER_SELECTOR)]
    .map(articleImageItem)
    .filter(Boolean);
}

export function wrapGalleryIndex(index, delta, length) {
  if (!Number.isInteger(length) || length < 1) return 0;
  const current = Number.isFinite(index) ? Math.trunc(index) : 0;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return ((current + step) % length + length) % length;
}

function addGalleryStyles(doc) {
  if (doc.getElementById('deedee-article-gallery-styles')) return;
  const style = doc.createElement('style');
  style.id = 'deedee-article-gallery-styles';
  style.textContent = `
    #${GALLERY_ROOT_ID}[hidden] { display: none !important; }
    #${GALLERY_ROOT_ID} {
      position: fixed; inset: 0; z-index: 2147483647; display: grid;
      grid-template-rows: 64px minmax(0, 1fr) 48px; box-sizing: border-box;
      padding: 0 20px; color: #fff; background: rgba(0, 0, 0, .96);
      font: 16px/1.4 Arial, sans-serif;
    }
    #${GALLERY_ROOT_ID} * { box-sizing: border-box; }
    #${GALLERY_ROOT_ID} [data-gallery-toolbar] {
      display: flex; align-items: center; justify-content: flex-end; gap: 18px;
    }
    #${GALLERY_ROOT_ID} [data-gallery-counter] { margin-right: auto; opacity: .88; }
    #${GALLERY_ROOT_ID} button {
      display: grid; place-items: center; min-width: 44px; min-height: 44px;
      padding: 0; border: 0; color: inherit; background: transparent;
      font: inherit; cursor: pointer;
    }
    #${GALLERY_ROOT_ID} [data-gallery-close] { font-size: 36px; font-weight: 300; }
    #${GALLERY_ROOT_ID} [data-gallery-stage] {
      display: grid; grid-template-columns: minmax(44px, 1fr) minmax(0, 1000px) minmax(44px, 1fr);
      align-items: center; justify-items: center; min-height: 0;
    }
    #${GALLERY_ROOT_ID} [data-gallery-stage] button { font-size: 48px; font-weight: 300; }
    #${GALLERY_ROOT_ID} figure { display: grid; place-items: center; width: 100%; height: 100%; margin: 0; min-width: 0; min-height: 0; }
    #${GALLERY_ROOT_ID} img {
      display: block; max-width: 100%; max-height: 100%; width: auto; height: auto;
      object-fit: contain;
    }
    #${GALLERY_ROOT_ID} [data-gallery-status] {
      display: flex; align-items: center; justify-content: center; opacity: .8;
    }
    #${GALLERY_ROOT_ID} button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
    [data-hook="image-viewer"][data-local-gallery-ready] { cursor: zoom-in; }
    [data-hook="image-expand-button"] { cursor: zoom-in; }
    @media (max-width: 600px) {
      #${GALLERY_ROOT_ID} { grid-template-rows: 56px minmax(0, 1fr) 42px; padding: 0 8px; }
      #${GALLERY_ROOT_ID} [data-gallery-stage] { grid-template-columns: 44px minmax(0, 1fr) 44px; }
      #${GALLERY_ROOT_ID} [data-gallery-stage] button { font-size: 38px; }
      #${GALLERY_ROOT_ID} img { max-width: 100%; max-height: 100%; }
    }
  `;
  doc.head.append(style);
}

function createButton(doc, label, glyph, attribute) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.setAttribute(attribute, '');
  button.textContent = glyph;
  return button;
}

function createGallery(doc, isEnglish) {
  addGalleryStyles(doc);
  const dialog = doc.createElement('div');
  dialog.id = GALLERY_ROOT_ID;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', isEnglish ? 'Fullscreen gallery' : 'Thư viện ảnh toàn màn hình');
  dialog.tabIndex = -1;
  dialog.hidden = true;

  const toolbar = doc.createElement('div');
  toolbar.setAttribute('data-gallery-toolbar', '');
  const counter = doc.createElement('span');
  counter.setAttribute('data-gallery-counter', '');
  counter.setAttribute('aria-live', 'polite');
  const closeLabel = isEnglish ? 'Close' : 'Đóng';
  const previousLabel = isEnglish ? 'Previous' : 'Ảnh trước';
  const nextLabel = isEnglish ? 'Next' : 'Ảnh tiếp theo';
  const close = createButton(doc, closeLabel, '×', 'data-gallery-close');
  toolbar.append(counter, close);

  const stage = doc.createElement('div');
  stage.setAttribute('data-gallery-stage', '');
  const previous = createButton(doc, previousLabel, '‹', 'data-gallery-previous');
  const figure = doc.createElement('figure');
  const image = doc.createElement('img');
  figure.append(image);
  const next = createButton(doc, nextLabel, '›', 'data-gallery-next');
  stage.append(previous, figure, next);

  const status = doc.createElement('div');
  status.setAttribute('data-gallery-status', '');
  dialog.append(toolbar, stage, status);
  doc.body.append(dialog);

  return { dialog, counter, close, previous, next, image, status, closeLabel, previousLabel, nextLabel };
}

export function installArticleGallery(root = document) {
  if (!root?.querySelectorAll || installedRoots.has(root)) return false;
  const entries = [...root.querySelectorAll(IMAGE_VIEWER_SELECTOR)]
    .map(viewer => ({ viewer, item: articleImageItem(viewer) }))
    .filter(entry => entry.item);
  if (!entries.length) return false;
  installedRoots.add(root);

  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  if (!doc?.body || !doc?.head) return false;
  const isEnglish = /^en(?:-|$)/i.test(doc.documentElement?.lang || '') ||
    /(?:^|\/)en\//i.test(doc.defaultView?.location?.pathname || '');
  const gallery = createGallery(doc, isEnglish);
  const viewers = entries.map(entry => entry.viewer);
  const items = entries.map(entry => entry.item);
  let activeIndex = 0;
  let opener = null;
  let previousOverflow = '';

  function render() {
    const item = items[activeIndex];
    gallery.image.src = item.src;
    gallery.image.alt = item.alt;
    gallery.counter.textContent = `${activeIndex + 1} / ${items.length}`;
    gallery.status.textContent = '';
    gallery.previous.hidden = items.length < 2;
    gallery.next.hidden = items.length < 2;
  }

  function open(index, focusTarget) {
    if (!items.length) return;
    activeIndex = wrapGalleryIndex(index, 0, items.length);
    opener = focusTarget;
    render();
    previousOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
    gallery.dialog.hidden = false;
    gallery.close.focus();
  }

  function close() {
    gallery.dialog.hidden = true;
    doc.body.style.overflow = previousOverflow;
    opener?.focus?.();
    opener = null;
  }

  function move(delta) {
    activeIndex = wrapGalleryIndex(activeIndex, delta, items.length);
    render();
  }

  const activate = (event) => {
    const target = event.target;
    const expandButton = target.closest?.('[data-hook="image-expand-button"]');
    const viewer = target.closest?.(IMAGE_VIEWER_SELECTOR) ||
      expandButton?.parentElement?.querySelector?.(IMAGE_VIEWER_SELECTOR);
    if (!viewer) return;
    if (!expandButton && target.closest?.('a, button')) return;
    const index = viewers.indexOf(viewer);
    if (index < 0) return;
    event.preventDefault();
    event.stopPropagation();
    open(index, expandButton || viewer);
  };

  viewers.forEach((viewer, index) => {
    viewer.dataset.localGalleryReady = 'true';
    viewer.tabIndex = 0;
    viewer.setAttribute('role', 'button');
    viewer.setAttribute('aria-label', isEnglish
      ? `Open image ${index + 1} of ${items.length}`
      : `Mở ảnh ${index + 1} trên ${items.length}`);
  });

  root.addEventListener('click', activate);
  root.addEventListener('keydown', event => {
    const target = event.target;
    if ((event.key === 'Enter' || event.key === ' ') &&
      (target.closest?.(IMAGE_VIEWER_SELECTOR) || target.closest?.('[data-hook="image-expand-button"]'))) {
      activate(event);
    }
  });

  gallery.close.addEventListener('click', close);
  gallery.previous.addEventListener('click', () => move(-1));
  gallery.next.addEventListener('click', () => move(1));
  gallery.dialog.addEventListener('click', event => {
    if (event.target === gallery.dialog) close();
  });
  doc.addEventListener('keydown', event => {
    if (gallery.dialog.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Tab') {
      const focusables = [gallery.close, gallery.previous, gallery.next].filter(button => !button.hidden);
      const index = focusables.indexOf(doc.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        focusables.at(-1)?.focus();
      } else if (!event.shiftKey && index === focusables.length - 1) {
        event.preventDefault();
        focusables[0]?.focus();
      }
    }
  });

  return true;
}

if (typeof document !== 'undefined') installArticleGallery();
