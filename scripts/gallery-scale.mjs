/**
 * Wix recomputes Pro Gallery geometry in JavaScript. The mirror keeps the pixel sizes frozen at capture time
 * (a ~1421px container), so on any other width the rows come out about 1% too short or too tall.
 * Where nothing in the stylesheets re-flows a gallery, scale it to the width it actually has.
 */
const MIN_SCALE = 0.6;
// Up to ~2560px screens (2560 / 1421 = 1.8); live Wix keeps scaling these rows in proportion on wide displays.
const MAX_SCALE = 1.8;
const IGNORED_DELTA = 0.002;

function galleryHost(margin) {
  return margin.closest('[id^="gallery-wrapper-comp-"]') ?? margin.closest('.pro-gallery-parent-container');
}

export function scaleBakedGalleries(root = document) {
  let scaled = 0;
  for (const margin of root.querySelectorAll('.pro-gallery-margin-container')) {
    const baked = Number.parseFloat(margin.style?.width);
    const host = typeof margin.closest === 'function' ? galleryHost(margin) : null;
    const container = host?.parentElement;
    if (!baked || !container) continue;
    host.style.zoom = '';
    host.style.removeProperty('--gallery-text-zoom');
    // If CSS already re-flows the gallery (grid layouts, tablet and phone rules) its width no longer equals
    // the frozen inline width; leave those alone.
    if (Math.abs(margin.getBoundingClientRect().width - baked) > 1) continue;
    const scale = container.getBoundingClientRect().width / baked;
    if (!Number.isFinite(scale) || scale < MIN_SCALE || scale > MAX_SCALE || Math.abs(scale - 1) < IGNORED_DELTA) continue;
    host.style.zoom = String(scale);
    // Wix scales tiles with the container but keeps overlay text at its authored size; counter-zoom the text.
    host.style.setProperty('--gallery-text-zoom', String(1 / scale));
    scaled += 1;
  }
  return scaled;
}

export function installGalleryScaling(root = document, win = globalThis.window) {
  scaleBakedGalleries(root);
  win?.addEventListener?.('resize', () => scaleBakedGalleries(root), { passive: true });
}
