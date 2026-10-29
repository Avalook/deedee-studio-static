export const HOMEPAGE_AWARDS_GALLERY_IDS = Object.freeze([
  'pro-gallery-comp-m7sdvo7i1',
  'pro-gallery-comp-m7uj2sj8',
  'pro-gallery-comp-m7uj35le',
]);

// Wix picks the phone layout by user agent; on it each strip shows ~3.3 fixed-size laurels whatever the width.
export const AWARD_PHONE_MAX_VIEWPORT = 600;
export const AWARD_PHONE_ITEM_WIDTH_PX = 116;
export const AWARD_PHONE_STEP_PX = 115;
export const AWARD_PHONE_TAIL_PX = 101;

export function isAwardPhoneViewport(viewportWidth) {
  const width = Number(viewportWidth);
  return Number.isFinite(width) && width > 0 && width <= AWARD_PHONE_MAX_VIEWPORT;
}

export function awardGalleryItemWidth(scrollerWidth, viewportWidth) {
  if (isAwardPhoneViewport(viewportWidth)) return AWARD_PHONE_ITEM_WIDTH_PX;
  const width = Number(scrollerWidth);
  if (!Number.isFinite(width) || width <= 0) return 0;
  return Math.max(0, Math.round((width - 125) / 5));
}

export function awardGalleryStep(itemWidth, viewportWidth) {
  const width = Number(itemWidth);
  if (!Number.isFinite(width) || width <= 0) return 0;
  return isAwardPhoneViewport(viewportWidth) ? AWARD_PHONE_STEP_PX : width + 25;
}

export function awardGalleryStartOffset(itemWidth, viewportWidth) {
  return isAwardPhoneViewport(viewportWidth) ? 0 : awardGalleryStep(itemWidth) + 1;
}

export function awardGalleryItemLeft(index, itemWidth = 49, viewportWidth) {
  const itemIndex = Number(index);
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return 0;
  return itemIndex * awardGalleryStep(itemWidth, viewportWidth);
}

export const AWARD_GALLERY_START_OFFSET_PX = 75;
export const AWARD_GALLERY_STEP_PX = 74;
export const AWARD_GALLERY_MOVE_DURATION_MS = 800;
export const AWARD_GALLERY_INTERVAL_MS = 2000;
// The two desktop laurel strips (gold and black rows); live advances them one laurel every 2 s, endlessly.
export const DESKTOP_AWARDS_GALLERY_IDS = Object.freeze(['pro-gallery-comp-m6xt2xqy', 'pro-gallery-comp-m6xtc7dq']);

export function updateAwardsGalleryGeometry(gallery) {
  const scroller = gallery.querySelector('.gallery-horizontal-scroll');
  if (!scroller) return null;

  const scrollerWidth = scroller.clientWidth || scroller.getBoundingClientRect?.().width || 0;
  const viewport = gallery.ownerDocument?.defaultView?.innerWidth;
  const itemWidth = awardGalleryItemWidth(scrollerWidth, viewport);
  const step = awardGalleryStep(itemWidth, viewport);
  const items = [...gallery.querySelectorAll('[data-hook="item-container"]')].filter(item => item.closest('[data-deedee-awards-copy]')?.dataset?.deedeeAwardsCopy !== 'true');
  const inner = scroller.querySelector?.('.gallery-horizontal-scroll-inner');
  const contentWidth = items.length * step + (isAwardPhoneViewport(viewport) ? AWARD_PHONE_TAIL_PX : 88);

  inner?.style.setProperty('--deedee-award-content-width', `${contentWidth}px`);
  for (const [index, item] of items.entries()) {
    const left = awardGalleryItemLeft(index, itemWidth, viewport);
    const group = item.closest('[data-hook="group-view"]');
    group?.style.setProperty('--group-left', `${left}px`);
    group?.style.setProperty('--group-width', `${step}px`);
    item.style.setProperty('--deedee-award-item-left', `${left}px`);
    item.style.setProperty('--deedee-award-item-width', `${itemWidth}px`);
  }

  return { contentWidth, itemWidth, step, startOffset: awardGalleryStartOffset(itemWidth, viewport) };
}

function cubicBezierProgress(progress) {
  const coordinate = (t, first, second) => (
    3 * (1 - t) ** 2 * t * first
    + 3 * (1 - t) * t ** 2 * second
    + t ** 3
  );
  let low = 0;
  let high = 1;
  let t = progress;

  for (let step = 0; step < 10; step += 1) {
    t = (low + high) / 2;
    if (coordinate(t, 0.46, 0.25) < progress) low = t;
    else high = t;
  }

  return coordinate(t, 0.1, 1);
}

function installAwardsCarousel(gallery, win) {
  const scroller = gallery.querySelector('.gallery-horizontal-scroll');
  if (!scroller || !win?.requestAnimationFrame || scroller.dataset.deedeeAwardsMotionInstalled === 'true') {
    return false;
  }

  scroller.dataset.deedeeAwardsMotionInstalled = 'true';
  const motionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const activePointers = new Set();
  const state = {
    frame: null,
    initialized: false,
    pausedReasons: new Set(motionQuery?.matches ? ['reduced-motion'] : []),
    reducedMotion: Boolean(motionQuery?.matches),
    target: null,
    timer: null,
    visible: false,
  };
  const canMove = () => state.visible && !state.reducedMotion && state.pausedReasons.size === 0;
  const schedule = (delay) => {
    win.clearTimeout(state.timer);
    if (canMove()) state.timer = win.setTimeout(advance, delay);
  };
  const animate = () => {
    if (!canMove() || state.target === null) return;
    const from = scroller.scrollLeft;
    const target = state.target;
    const duration = Math.max(
      120,
      AWARD_GALLERY_MOVE_DURATION_MS * Math.min(1, Math.abs(target - from) / awardGalleryStep(awardGalleryItemWidth(scroller.clientWidth, win.innerWidth), win.innerWidth)),
    );
    const startedAt = win.performance.now();

    const tick = (now) => {
      if (!canMove()) {
        state.frame = null;
        return;
      }

      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = cubicBezierProgress(progress);
      scroller.scrollLeft = from + (target - from) * eased;
      if (progress < 1) {
        state.frame = win.requestAnimationFrame(tick);
        return;
      }

      scroller.scrollLeft = target;
      state.frame = null;
      state.target = null;
      schedule(AWARD_GALLERY_INTERVAL_MS - AWARD_GALLERY_MOVE_DURATION_MS);
    };

    state.frame = win.requestAnimationFrame(tick);
  };
  function advance() {
    if (!canMove()) return;
    const itemWidth = awardGalleryItemWidth(scroller.clientWidth, win.innerWidth);
    const step = awardGalleryStep(itemWidth, win.innerWidth);
    const startOffset = awardGalleryStartOffset(itemWidth, win.innerWidth);
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    if (maxScroll <= startOffset || step <= 0) {
      schedule(AWARD_GALLERY_INTERVAL_MS);
      return;
    }

    if (scroller.scrollLeft + step > maxScroll) scroller.scrollLeft = startOffset;
    state.target = Math.min(scroller.scrollLeft + step, maxScroll);
    animate();
  }
  const pause = (reason) => {
    state.pausedReasons.add(reason);
    win.clearTimeout(state.timer);
    if (state.frame !== null) win.cancelAnimationFrame(state.frame);
    state.frame = null;
  };
  const resume = (reason) => {
    state.pausedReasons.delete(reason);
    if (!canMove()) return;
    if (state.target !== null) animate();
    else schedule(AWARD_GALLERY_INTERVAL_MS - AWARD_GALLERY_MOVE_DURATION_MS);
  };
  const onVisibility = (visible) => {
    if (state.visible === visible) return;
    state.visible = visible;
    if (!visible) {
      pause('offscreen');
      return;
    }

    state.pausedReasons.delete('offscreen');
    if (!state.initialized) {
      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const startOffset = awardGalleryStartOffset(awardGalleryItemWidth(scroller.clientWidth, win.innerWidth), win.innerWidth);
      scroller.scrollLeft = Math.min(startOffset, maxScroll);
      state.initialized = true;
      scroller.dataset.deedeeAwardsMotionStarted = 'true';
      schedule(AWARD_GALLERY_INTERVAL_MS);
    } else if (state.target !== null) {
      animate();
    } else {
      schedule(AWARD_GALLERY_INTERVAL_MS - AWARD_GALLERY_MOVE_DURATION_MS);
    }
  };
  const checkVisibility = () => {
    const bounds = scroller.getBoundingClientRect();
    onVisibility(bounds.bottom > 0 && bounds.top < win.innerHeight);
  };

  scroller.addEventListener('pointerenter', () => pause('pointer-hover'));
  scroller.addEventListener('pointerleave', () => resume('pointer-hover'));
  const handlePointerDown = (event) => {
    activePointers.add(event.pointerId);
    pause('pointer-input');
  };
  const handlePointerEnd = (event) => {
    if (!activePointers.delete(event.pointerId) || activePointers.size > 0) return;
    resume('pointer-input');
  };
  const clearPointerState = () => {
    if (activePointers.size === 0) return;
    activePointers.clear();
    resume('pointer-input');
  };
  scroller.addEventListener('pointerdown', handlePointerDown);
  win.addEventListener('pointerup', handlePointerEnd);
  win.addEventListener('pointercancel', handlePointerEnd);
  win.addEventListener('blur', clearPointerState);
  scroller.addEventListener('focusin', () => pause('keyboard-focus'));
  scroller.addEventListener('focusout', () => resume('keyboard-focus'));
  motionQuery?.addEventListener?.('change', (event) => {
    state.reducedMotion = event.matches;
    if (event.matches) pause('reduced-motion');
    else resume('reduced-motion');
  });
  win.addEventListener('scroll', checkVisibility, { passive: true });
  win.addEventListener('resize', () => {
    updateAwardsGalleryGeometry(gallery);
    checkVisibility();
  }, { passive: true });
  checkVisibility();

  return true;
}

/** Desktop award strips move like live: one laurel (one group) every 2 s, and loop forever.
    A decorative copy of the strip sits after the original so jumping back by one cycle is invisible. */
export function installSteppingAwardsGallery(gallery, win) {
  const scroller = gallery.querySelector('.gallery-horizontal-scroll');
  const inner = scroller?.querySelector?.('.gallery-horizontal-scroll-inner');
  if (!inner || !win?.setTimeout || scroller.dataset.deedeeSteppingAwards) return false;
  scroller.dataset.deedeeSteppingAwards = 'true';
  const copy = inner.cloneNode(true);
  copy.setAttribute('aria-hidden', 'true');
  copy.setAttribute('data-deedee-awards-copy', 'true');
  copy.setAttribute('inert', '');
  for (const node of [copy, ...copy.querySelectorAll('[id]')]) node.removeAttribute('id');
  for (const node of copy.querySelectorAll('a,button,input,select,textarea,[tabindex]')) node.setAttribute('tabindex', '-1');
  Object.assign(copy.style, { position: 'absolute', top: '0px' });
  scroller.style.position = 'relative';
  scroller.style.scrollBehavior = 'auto';
  scroller.style.scrollSnapType = 'none';
  scroller.append(copy);
  const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const paused = new Set(motion?.matches ? ['motion'] : []);
  const pointers = new Set();
  let timer = null;
  let cycle = 0;
  let step = 0;
  const measure = () => {
    const groups = Array.from(inner.children);
    cycle = Math.max(0, ...groups.map(group =>
      (parseFloat(group.style.getPropertyValue('--group-left')) || 0)
      + (parseFloat(group.style.getPropertyValue('--group-width')) || 0)));
    step = parseFloat(groups[0]?.style.getPropertyValue('--group-width')) || 0;
    copy.style.left = `${cycle}px`;
    copy.style.width = `${cycle}px`;
    if (cycle > 0 && scroller.scrollLeft >= cycle) scroller.scrollLeft %= cycle;
  };
  const visible = () => {
    const rect = scroller.getBoundingClientRect();
    return scroller.clientWidth > 0 && rect.bottom > 0 && rect.top < win.innerHeight;
  };
  const canMove = () => !paused.size && cycle > 0 && step > 0 && visible();
  const advance = () => {
    timer = null;
    if (!canMove()) return;
    let next = scroller.scrollLeft + step;
    if (next >= cycle) { scroller.scrollLeft -= cycle; next -= cycle; }
    scroller.scrollLeft = next;
    schedule();
  };
  function schedule() {
    win.clearTimeout(timer);
    timer = canMove() ? win.setTimeout(advance, AWARD_GALLERY_INTERVAL_MS) : null;
  }
  const pause = reason => { paused.add(reason); win.clearTimeout(timer); timer = null; };
  const resume = reason => { paused.delete(reason); if (timer === null) schedule(); };
  scroller.addEventListener('pointerenter', () => pause('hover'));
  scroller.addEventListener('pointerleave', () => resume('hover'));
  scroller.addEventListener('focusin', () => pause('focus'));
  scroller.addEventListener('focusout', () => resume('focus'));
  scroller.addEventListener('pointerdown', event => { pointers.add(event.pointerId); pause('drag'); });
  const end = event => { pointers.delete(event.pointerId); if (!pointers.size) resume('drag'); };
  win.addEventListener('pointerup', end);
  win.addEventListener('pointercancel', end);
  win.addEventListener('blur', () => { pointers.clear(); resume('drag'); });
  motion?.addEventListener?.('change', event => event.matches ? pause('motion') : resume('motion'));
  win.addEventListener('scroll', () => visible() ? resume('offscreen') : pause('offscreen'), { passive: true });
  win.addEventListener('resize', () => { measure(); visible() ? resume('offscreen') : pause('offscreen'); }, { passive: true });
  measure();
  schedule();
  return true;
}

export function installHomepageAwardsGallery(root = document) {
  let installed = 0;
  const win = root.defaultView
    ?? root.ownerDocument?.defaultView
    ?? (typeof window !== 'undefined' ? window : undefined);

  for (const galleryId of HOMEPAGE_AWARDS_GALLERY_IDS) {
    const gallery = root.getElementById(galleryId);
    if (!gallery) continue;

    updateAwardsGalleryGeometry(gallery);
    installAwardsCarousel(gallery, win);
    installed += 1;
  }

  for (const id of DESKTOP_AWARDS_GALLERY_IDS) {
    const gallery = root.getElementById(id);
    if (gallery && installSteppingAwardsGallery(gallery, win)) installed += 1;
  }
  return installed;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installHomepageAwardsGallery(document), { once: true });
  } else {
    installHomepageAwardsGallery(document);
  }
}
