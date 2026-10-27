import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Search engines and link-preview bots read the page's own <head>, not what a script changes later, so a published
 * SEO edit is written into the static page's title and meta tags. The tags it replaces are kept in seo-originals.json
 * so that removing the SEO edit puts the page back exactly as captured.
 */
export const SEO_LEDGER = 'seo-originals.json';

const TAGS = {
  title: /<title>[\s\S]*?<\/title>/i,
  description: /<meta\s+name="description"[^>]*>/i,
  ogTitle: /<meta\s+property="og:title"[^>]*>/i,
  ogDescription: /<meta\s+property="og:description"[^>]*>/i,
  ogImage: /<meta\s+property="og:image"(?=[\s>])[^>]*>/i,
  twTitle: /<meta\s+name="twitter:title"[^>]*>/i,
  twDescription: /<meta\s+name="twitter:description"[^>]*>/i,
  twImage: /<meta\s+name="twitter:image"[^>]*>/i,
  robots: /<meta\s+name="robots"[^>]*>/i,
};

const escapeAttr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const meta = (attr, name, content) => `<meta ${attr}="${name}" content="${escapeAttr(content)}">`;

/** The tags an SEO edit wants, keyed like TAGS. */
export function seoTags(seo, { imageUrl = (value) => value } = {}) {
  const wanted = {};
  if (seo.title) {
    wanted.title = `<title>${escapeText(seo.title)}</title>`;
    wanted.ogTitle = meta('property', 'og:title', seo.title);
    wanted.twTitle = meta('name', 'twitter:title', seo.title);
  }
  if (seo.description) {
    wanted.description = meta('name', 'description', seo.description);
    wanted.ogDescription = meta('property', 'og:description', seo.description);
    wanted.twDescription = meta('name', 'twitter:description', seo.description);
  }
  if (seo.image) {
    const image = imageUrl(seo.image);
    wanted.ogImage = meta('property', 'og:image', image);
    wanted.twImage = meta('name', 'twitter:image', image);
  }
  if (seo.noindex) wanted.robots = meta('name', 'robots', 'noindex,nofollow');
  return wanted;
}

/** Write the wanted tags into the head; returns the new html and, per tag, what it replaced (null when it was absent). */
export function bakeSeo(html, wanted) {
  const originals = {};
  let out = html;
  for (const [key, tag] of Object.entries(wanted)) {
    const match = TAGS[key].exec(out);
    originals[key] = match ? match[0] : null;
    if (match) out = out.slice(0, match.index) + tag + out.slice(match.index + match[0].length);
    else out = out.replace(/<\/head>/i, () => `${tag}</head>`);
  }
  return { html: out, originals };
}

/** Put back what bakeSeo replaced. */
export function restoreSeo(html, originals) {
  let out = html;
  for (const [key, original] of Object.entries(originals)) {
    const match = TAGS[key]?.exec(out);
    if (!match) continue;
    out = out.slice(0, match.index) + (original ?? '') + out.slice(match.index + match[0].length);
  }
  return out;
}

export function routeToFile(outDir, route) {
  if (typeof route !== 'string' || !route.startsWith('/') || route === '*') return null;
  let segments;
  try { segments = route.split('/').filter(Boolean).map(decodeURIComponent); } catch { return null; }
  if (segments.some((part) => part === '.' || part === '..' || part.includes('/') || part.includes('\\'))) return null;
  return path.join(outDir, ...segments, 'index.html');
}

async function readIfExists(file) {
  try { return await fs.readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function writeAtomic(file, contents) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, contents);
  await fs.rename(temp, file);
}

/**
 * Bring the static pages in line with the SEO edits of a release. `pages` maps route to its document.
 * Returns the repository-relative files that changed.
 */
export async function syncSeo({ outDir, pages, siteOrigin = '', basePath = '' }) {
  const ledgerFile = path.join(outDir, SEO_LEDGER);
  let ledger = { version: 1, pages: {} };
  try { ledger = JSON.parse(await fs.readFile(ledgerFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!ledger.pages || typeof ledger.pages !== 'object') ledger = { version: 1, pages: {} };
  const imageUrl = (value) => (value.startsWith('/') ? `${siteOrigin}${value.startsWith(`${basePath}/`) ? '' : basePath}${value}` : value);
  const changed = [];
  const wantedRoutes = new Set();

  for (const [route, document] of Object.entries(pages)) {
    if (route === '*' || !document.seo) continue;
    const file = routeToFile(outDir, route);
    const html = file && await readIfExists(file);
    if (html === null || html === undefined) continue;
    wantedRoutes.add(route);
    // Always start again from the captured tags so that clearing one field restores it.
    const previous = ledger.pages[route];
    const base = previous ? restoreSeo(html, previous) : html;
    const baked = bakeSeo(base, seoTags(document.seo, { imageUrl }));
    ledger.pages[route] = { ...previous, ...Object.fromEntries(Object.entries(baked.originals).filter(([key]) => !(previous && key in previous))) };
    if (baked.html !== html) { await writeAtomic(file, baked.html); changed.push(path.relative(outDir, file)); }
  }

  for (const route of Object.keys(ledger.pages)) {
    if (wantedRoutes.has(route)) continue;
    const file = routeToFile(outDir, route);
    const html = file && await readIfExists(file);
    if (html) {
      const restored = restoreSeo(html, ledger.pages[route]);
      if (restored !== html) { await writeAtomic(file, restored); changed.push(path.relative(outDir, file)); }
    }
    delete ledger.pages[route];
  }

  const serialized = `${JSON.stringify(ledger, null, 2)}\n`;
  const existing = await readIfExists(ledgerFile);
  if (existing !== serialized && (existing !== null || Object.keys(ledger.pages).length)) {
    await writeAtomic(ledgerFile, serialized);
    changed.push(SEO_LEDGER);
  }
  return changed;
}
