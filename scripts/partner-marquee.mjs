const MARQUEE_SPEED = 40;
const GALLERY_SELECTOR = '#gallery-horizontal-scroll-comp-m6vwcy1k';

export const PARTNER_BASE_LOGO_HEIGHT = 80;
export const PARTNER_SMALL_LOGO_HEIGHT = 50;
export const PARTNER_ROW_HEIGHT = 80;
export const PARTNER_SMALL_BREAKPOINT = 750;

export function advanceMarquee(position, elapsedMs, cycleWidth, visualScale = 1) {
  if (!Number.isFinite(position) || !Number.isFinite(elapsedMs) || !Number.isFinite(cycleWidth) ||
      !Number.isFinite(visualScale) || elapsedMs <= 0 || cycleWidth <= 0 || visualScale <= 0) return 0;
  return (position + elapsedMs * MARQUEE_SPEED / visualScale / 1000) % cycleWidth;
}

export function canAdvanceMarquee(state) {
  return Boolean(state) && !state.reducedMotion && !state.paused &&
    state.visibilityState === 'visible' && state.hasPreviousFrame &&
    Number.isFinite(state.cycleWidth) && state.cycleWidth > 0;
}

export function partnerViewportScale(viewportWidth) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 1;
  return partnerRowHeight(viewportWidth) / PARTNER_BASE_LOGO_HEIGHT;
}

const PARTNER_TABLET_MAX_WIDTH = 1100;

const PARTNER_TABLET_ROW_HEIGHT = 30;

export function partnerRowHeight(viewportWidth) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return PARTNER_ROW_HEIGHT;
  if (viewportWidth <= PARTNER_SMALL_BREAKPOINT) return PARTNER_SMALL_LOGO_HEIGHT;
  if (viewportWidth <= PARTNER_TABLET_MAX_WIDTH) return PARTNER_TABLET_ROW_HEIGHT;
  return PARTNER_ROW_HEIGHT;
}

export function partnerWidgetWidthPercent(viewportWidth) {
  return Number.isFinite(viewportWidth) && viewportWidth > PARTNER_TABLET_MAX_WIDTH ? 200 : 100;
}

// Wix gives the scroll strip 15px more than the widget box (518: widget 50 / gallery 65,
// 1440: widget 80 / gallery 95) and 15px more width on each side.
export const PARTNER_GALLERY_OVERHANG = 15;

export function partnerGalleryRowHeight(viewportWidth) {
  return partnerRowHeight(viewportWidth) + PARTNER_GALLERY_OVERHANG;
}

export function scaledPartnerLength(value, scale) {
  if (!Number.isFinite(value) || !Number.isFinite(scale) || scale <= 0) return 0;
  return Math.round(value * scale * 1000) / 1000;
}

export function partnerCycleWidth(groups, scale = 1) {
  if (!Array.isArray(groups)) return 0;
  return groups.reduce((width, group) => {
    const left = scaledPartnerLength(group?.left, scale);
    const groupWidth = scaledPartnerLength(group?.width, scale);
    return Math.max(width, left + groupWidth);
  }, 0);
}

export function partnerItemTop(rowHeight, itemHeight) {
  if (!Number.isFinite(rowHeight) || !Number.isFinite(itemHeight) || rowHeight <= 0 || itemHeight < 0) return 0;
  const centeredOffset = Math.max(0, (rowHeight - itemHeight) / 2);
  return Math.round((15 + centeredOffset) * 1000) / 1000;
}

function parsePx(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function px(value) {
  return `${scaledPartnerLength(value, 1)}px`;
}

function styleState(root) {
  return [root, ...root.querySelectorAll('[style]')].map(element => ({
    element,
    style: element.getAttribute('style') || null
  }));
}

function restoreStyles(entries) {
  entries.forEach(({ element, style }) => {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
  });
}

function itemElements(container) {
  return {
    container,
    wrapper: container.querySelector('[data-hook="item-wrapper"]'),
    content: container.querySelector('[data-hook="image-item"]'),
    hoverFrame: container.querySelector('.item-hover-flex-container'),
    hover: container.querySelector('.gallery-item-hover'),
    image: container.querySelector('img')
  };
}

function captureGroup(group) {
  const left = parsePx(group.style.getPropertyValue('--group-left'));
  const width = parsePx(group.style.getPropertyValue('--group-width'));
  const items = [...group.querySelectorAll('[data-hook="item-container"]')].map(container => {
    const style = container.style;
    const rawLeft = style.left || style.insetLeft;
    return {
      left: rawLeft ? parsePx(rawLeft) : left,
      width: parsePx(style.width),
      height: parsePx(style.height),
      elements: itemElements(container)
    };
  });
  return { group, left, width, items };
}

function applyPartnerItem(item, scale, rowHeight) {
  const width = scaledPartnerLength(item.width, scale);
  const height = scaledPartnerLength(item.height, scale);
  const left = scaledPartnerLength(item.left, scale);
  const top = partnerItemTop(rowHeight, height);
  const { container, wrapper, content, hoverFrame, hover, image } = item.elements;

  container.style.inset = '';
  container.style.position = 'absolute';
  container.style.top = px(top);
  container.style.right = 'auto';
  container.style.bottom = 'auto';
  container.style.left = px(left);
  container.style.margin = '0';
  container.style.width = px(width);
  container.style.height = px(height);

  [wrapper, content, hoverFrame, hover].forEach(element => {
    if (!element) return;
    element.style.width = px(width);
    element.style.height = px(height);
    element.style.margin = '0';
  });
  if (hoverFrame) {
    hoverFrame.style.top = '0';
    hoverFrame.style.left = '0';
    hoverFrame.style.alignItems = 'center';
  }
  if (image) {
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = 'contain';
  }
}

function applyRow(gallery, parent, outer, widget, track, rowHeight, viewportWidth) {
  const row = px(rowHeight);
  const galleryHeight = px(partnerGalleryRowHeight(viewportWidth));
  widget.style.width = `${partnerWidgetWidthPercent(viewportWidth)}%`;
  widget.style.height = row;
  widget.style.maxHeight = row;
  widget.style.overflow = 'visible';
  parent.style.width = '100%';
  parent.style.height = row;
  parent.style.margin = '-15px 0 0 -15px';
  outer.style.width = `calc(100% + ${PARTNER_GALLERY_OVERHANG * 2}px)`;
  outer.style.height = galleryHeight;
  outer.style.flexShrink = '0';
  gallery.style.width = '100%';
  gallery.style.maxWidth = 'none';
  gallery.style.height = galleryHeight;
  gallery.style.flexShrink = '0';
  gallery.style.overflowX = 'auto';
  gallery.style.overflowY = 'hidden';
  gallery.style.scrollbarWidth = 'none';
  track.style.height = galleryHeight;
}

function duplicateGroup(capture, cycleWidth) {
  const source = capture.group;
  const duplicate = source.cloneNode(true);
  duplicate.style.setProperty('--group-left', px(parsePx(source.style.getPropertyValue('--group-left')) + cycleWidth));
  duplicate.querySelectorAll('[data-hook="item-container"]').forEach(container => {
    const style = container.style;
    style.inset = '';
    style.left = px((parsePx(style.left) || parsePx(style.insetLeft)) + cycleWidth);
  });
  duplicate.setAttribute('aria-hidden', 'true');
  duplicate.dataset.deedeeMarqueeClone = 'true';
  duplicate.removeAttribute('id');
  duplicate.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  duplicate.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
  return duplicate;
}

function ensureState(gallery, track, parent, outer, widget) {
  if (gallery.deedeePartnerMarquee) return gallery.deedeePartnerMarquee;
  const originals = [...track.querySelectorAll(':scope > [data-hook="group-view"]')]
    .filter(group => group.dataset.deedeeMarqueeClone !== 'true');
  const state = {
    gallery, track, parent, outer, widget,
    containers: styleState(gallery).concat(styleState(parent), styleState(outer), styleState(widget), styleState(track)),
    groups: originals.map(captureGroup),
    groupStyles: originals.map(styleState),
    animationStarted: false,
    listenersInstalled: false,
    paused: false,
    lastFrame: 0,
    position: 0,
    reducedMotion: false
  };
  Object.defineProperty(gallery, 'deedeePartnerMarquee', { value: state, configurable: true, enumerable: false });
  return state;
}

function layoutPartner(state, viewportWidth) {
  const scale = partnerViewportScale(viewportWidth);
  const rowHeight = partnerRowHeight(viewportWidth);
  restoreStyles(state.containers);
  state.groupStyles.forEach(restoreStyles);
  applyRow(state.gallery, state.parent, state.outer, state.widget, state.track, rowHeight, viewportWidth);

  state.groups.forEach(capture => {
    capture.group.style.setProperty('--group-left', px(scaledPartnerLength(capture.left, scale)));
    capture.group.style.setProperty('--group-width', px(scaledPartnerLength(capture.width, scale)));
    capture.items.forEach(item => applyPartnerItem(item, scale, rowHeight));
  });

  state.track.querySelectorAll('[data-deedee-marquee-clone="true"]').forEach(node => node.remove());
  const cycleWidth = partnerCycleWidth(state.groups, scale);
  state.track.style.width = px(cycleWidth * 2);
  state.gallery.dataset.deedeeMarqueeCycle = String(cycleWidth);
  state.position = cycleWidth > 0 ? state.position % cycleWidth : 0;
  state.written = true;
  state.gallery.scrollLeft = state.position;
  if (cycleWidth > 0) state.groups.forEach(capture => state.track.append(duplicateGroup(capture, cycleWidth)));
  return cycleWidth;
}

function watchReducedMotion(state, startAnimation) {
  state.motionQuery?.addEventListener?.('change', event => {
    state.reducedMotion = Boolean(event.matches);
    state.gallery.dataset.deedeeMarqueeAnimation = state.reducedMotion ? 'reduced-motion' : 'enabled';
    state.lastFrame = 0;
    if (!state.reducedMotion) startAnimation(state);
  });
}

export function startAnimation(state) {
  if (!state.listenersInstalled) {
    state.listenersInstalled = true;
    state.gallery.addEventListener('scroll', () => {
      if (state.written) { state.written = false; return; }
      const cycleWidth = parsePx(state.gallery.dataset.deedeeMarqueeCycle);
      state.position = cycleWidth > 0 ? state.gallery.scrollLeft % cycleWidth : 0;
    });
    state.gallery.addEventListener('pointerenter', () => { state.paused = true; });
    state.gallery.addEventListener('pointerleave', () => { state.paused = false; state.lastFrame = 0; });
    state.gallery.addEventListener('focusin', () => { state.paused = true; });
    state.gallery.addEventListener('focusout', event => {
      if (!state.gallery.contains(event.relatedTarget)) { state.paused = false; state.lastFrame = 0; }
    });
    state.doc.addEventListener('visibilitychange', () => { state.lastFrame = 0; });
    state.win.addEventListener('resize', () => layoutPartner(state, state.win.innerWidth));
    watchReducedMotion(state, startAnimation);
  }
  if (state.animationStarted || state.reducedMotion) return;

  state.animationStarted = true;
  const win = state.win;
  const animate = time => {
    if (state.reducedMotion) {
      state.animationStarted = false;
      state.lastFrame = 0;
      return;
    }
    const cycleWidth = parsePx(state.gallery.dataset.deedeeMarqueeCycle);
    if (canAdvanceMarquee({
      reducedMotion: state.reducedMotion,
      paused: state.paused,
      visibilityState: state.doc.visibilityState,
      hasPreviousFrame: Boolean(state.lastFrame),
      cycleWidth
    })) {
      state.position = advanceMarquee(state.position, Math.min(time - state.lastFrame, 100), cycleWidth);
      state.written = true;
      state.gallery.scrollLeft = state.position;
    }
    state.lastFrame = time;
    win.requestAnimationFrame(animate);
  };
  win.requestAnimationFrame(animate);
}

export function installPartnerMarquee(root = document) {
  const gallery = root.querySelector(GALLERY_SELECTOR);
  const track = gallery?.querySelector('.gallery-horizontal-scroll-inner');
  const parent = gallery?.closest('.pro-gallery-parent-container');
  const outer = gallery?.closest('.pro-gallery');
  const widget = gallery?.closest('#comp-m6vwcy1k');
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const win = doc?.defaultView;
  if (!gallery || !track || !parent || !outer || !widget || !win?.requestAnimationFrame) return false;

  const state = ensureState(gallery, track, parent, outer, widget);
  if (!state.groups.length) return false;
  state.doc = doc;
  state.win = win;
  state.motionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  state.reducedMotion = Boolean(state.motionQuery?.matches);
  const cycleWidth = layoutPartner(state, win.innerWidth);
  if (cycleWidth <= 0) return false;
  gallery.dataset.deedeeMarqueeInstalled = 'true';
  gallery.dataset.deedeeMarqueeAnimation = state.reducedMotion ? 'reduced-motion' : 'enabled';
  startAnimation(state);
  return true;
}
