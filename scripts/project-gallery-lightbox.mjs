const galleryRoots = [...document.querySelectorAll('body[data-deedee-project-gallery="true"] .pro-gallery-margin-container')];

if (galleryRoots.length) {
  const overlay = document.createElement('div');
  overlay.className = 'deedee-gallery-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image gallery');
  overlay.hidden = true;

  const image = document.createElement('img');
  image.className = 'deedee-gallery-lightbox__image';

  const closeButton = createButton('Close image gallery', '×', 'close');
  const previousButton = createButton('Previous item', '‹', 'previous');
  const nextButton = createButton('Next item', '›', 'next');
  const counter = document.createElement('p');
  counter.className = 'deedee-gallery-lightbox__counter';
  counter.setAttribute('aria-live', 'polite');

  overlay.append(closeButton, previousButton, image, nextButton, counter);
  document.body.append(overlay);

  let activeItems = [];
  let activeIndex = 0;
  let previousFocus = null;
  let pageBackground = null;
  let backgroundWasInert = false;
  let backgroundAriaHidden = null;

  function createButton(label, content, kind) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `deedee-gallery-lightbox__${kind}`;
    button.setAttribute('aria-label', label);
    button.textContent = content;
    return button;
  }

  // The archived markup makes only the first tile of each gallery tabbable because Wix's
  // runtime owned roving focus, so tile navigation is re-implemented here.
  const galleryNav = new Map();

  function galleryItems(gallery) {
    return [...gallery.querySelectorAll('[data-hook="item-container"]')]
      .filter((item) => item.querySelector('[data-hook="gallery-item-image-img"]'));
  }

  function setRovingFocus(nav, index) {
    nav.actions.forEach((action, i) => action?.setAttribute('tabindex', i === index ? '0' : '-1'));
  }

  function moveToFocus(nav, index, step) {
    const count = nav.actions.length;
    for (let offset = 0; offset < count; offset += 1) {
      const candidate = (((index + step * offset) % count) + count) % count;
      const action = nav.actions[candidate];
      if (!action) continue;
      setRovingFocus(nav, candidate);
      action.focus();
      return;
    }
  }

  function showItem(index) {
    activeIndex = (index + activeItems.length) % activeItems.length;
    const sourceImage = activeItems[activeIndex].querySelector('[data-hook="gallery-item-image-img"]');
    if (!sourceImage) return;

    image.src = sourceImage.currentSrc || sourceImage.src;
    image.alt = sourceImage.alt || 'Project image';
    overlay.setAttribute('aria-label', `Image ${activeIndex + 1} of ${activeItems.length}`);
    counter.textContent = `${activeIndex + 1} / ${activeItems.length}`;
  }

  function openGallery(item, gallery) {
    const nav = galleryNav.get(gallery);
    if (!nav) return;
    activeItems = nav.items;
    activeIndex = nav.items.indexOf(item);
    if (activeIndex < 0) return;

    previousFocus = item.querySelector('[data-hook="item-action"]') || item;
    setRovingFocus(nav, activeIndex);
    showItem(activeIndex);
    pageBackground = document.getElementById('SITE_CONTAINER') || document.querySelector('main');
    backgroundWasInert = pageBackground && 'inert' in pageBackground ? pageBackground.inert : false;
    backgroundAriaHidden = pageBackground?.getAttribute('aria-hidden') ?? null;
    overlay.hidden = false;
    document.body.classList.add('deedee-gallery-lightbox-open');
    if (pageBackground) {
      if ('inert' in pageBackground) pageBackground.inert = true;
      pageBackground.setAttribute('aria-hidden', 'true');
    }
    closeButton.focus();
  }

  function closeGallery() {
    overlay.hidden = true;
    image.removeAttribute('src');
    document.body.classList.remove('deedee-gallery-lightbox-open');
    if (pageBackground) {
      if ('inert' in pageBackground) pageBackground.inert = backgroundWasInert;
      if (backgroundAriaHidden === null) pageBackground.removeAttribute('aria-hidden');
      else pageBackground.setAttribute('aria-hidden', backgroundAriaHidden);
    }
    previousFocus?.focus();
  }

  for (const gallery of galleryRoots) {
    const items = galleryItems(gallery);
    const actions = items.map((item) => item.querySelector('[data-hook="item-action"]'));
    const nav = { items, actions };
    galleryNav.set(gallery, nav);
    setRovingFocus(nav, Math.max(0, actions.findIndex((action) => action?.getAttribute('tabindex') === '0')));

    items.forEach((item, index) => {
      item.addEventListener('click', () => openGallery(item, gallery));
      const action = actions[index];
      if (!action) return;
      action.setAttribute('aria-label', `Open image ${index + 1} of ${items.length}`);
      action.addEventListener('keydown', (event) => {
        if (!overlay.hidden) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          openGallery(item, gallery);
          return;
        }
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (step === undefined && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        event.stopPropagation();
        if (step === undefined) {
          const edge = event.key === 'Home' ? 0 : actions.length - 1;
          moveToFocus(nav, edge, event.key === 'Home' ? 1 : -1);
        } else {
          moveToFocus(nav, index + step, step);
        }
      });
    });
  }

  closeButton.addEventListener('click', closeGallery);
  previousButton.addEventListener('click', () => showItem(activeIndex - 1));
  nextButton.addEventListener('click', () => showItem(activeIndex + 1));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeGallery();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [closeButton, previousButton, nextButton];
    const firstControl = controls[0];
    const lastControl = controls.at(-1);
    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault();
      lastControl.focus();
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') closeGallery();
    if (event.key === 'ArrowLeft') showItem(activeIndex - 1);
    if (event.key === 'ArrowRight') showItem(activeIndex + 1);
  });
}
