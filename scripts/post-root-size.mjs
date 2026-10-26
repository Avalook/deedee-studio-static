/**
 * Wix's blog post page tags its root with size classes taken from the root's own width (xs, sm, md, lt-*, gt-*, ...),
 * and the typography and spacing rules key off them. The mirror froze the desktop set (980px wide), so on a narrower
 * window the article laid out too tall. These thresholds were read off the live page at widths from 335px to 980px.
 */
const MANAGED = /^(?:xs|sm|md|lg|xl|lt-(?:s|sm|md|lg|xl)|gt-(?:xs|s|sm|740|830|886|940)|w\d+-\d+|lte-w980|lte-post_content_area_(?:min|small)|lte-banner-w\d+|lte-category-header-w\d+)$/;

export function postRootSizeClasses(width) {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return [];
  const size = w < 686 ? 'xs' : w < 980 ? 'sm' : 'md';
  const classes = [size];
  if (w < 686) classes.push('lt-s', 'lt-sm');
  if (w < 980) classes.push('lt-md');
  classes.push('lt-lg', 'lt-xl');
  if (w >= 686) classes.push('gt-xs', 'gt-s');
  if (w >= 980) classes.push('gt-sm');
  if (w > 740) classes.push('gt-740');
  if (w > 830) classes.push('gt-830');
  if (w > 886) classes.push('gt-886');
  if (w > 940) classes.push('gt-940');
  if (w >= 686 && w <= 745) classes.push('w686-745');
  if (w >= 686 && w <= 980) classes.push('w686-980');
  if (w <= 980) classes.push('lte-w980');
  if (w <= 740) classes.push('lte-post_content_area_min');
  if (w <= 830) classes.push('lte-post_content_area_small');
  for (const limit of [1564, 1425, 1181, 980]) if (w <= limit) classes.push(`lte-banner-w${limit}`);
  if (w <= 1364) classes.push('lte-category-header-w1364');
  return classes;
}

export function applyPostRootSize(root) {
  const width = root?.getBoundingClientRect?.().width;
  const wanted = postRootSizeClasses(width);
  if (!wanted.length || !root.classList) return false;
  for (const name of [...root.classList]) if (MANAGED.test(name) && !wanted.includes(name)) root.classList.remove(name);
  for (const name of wanted) root.classList.add(name);
  return true;
}

export function installPostRootSize(root = document, win = globalThis.window) {
  const postRoot = root?.querySelector?.('[data-hook="post-page-root"]');
  if (!postRoot) return false;
  const update = () => applyPostRootSize(postRoot);
  update();
  win?.addEventListener?.('resize', update, { passive: true });
  win?.addEventListener?.('load', update, { once: true });
  if (typeof win?.ResizeObserver === 'function') new win.ResizeObserver(update).observe(postRoot);
  return true;
}
