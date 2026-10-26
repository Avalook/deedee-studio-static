import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { imageBytes, originalMediaUrl } from './restore-placeholder-assets.mjs';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATEGORY_ARCHIVES = [
  'blog/categories/hoạt-động/index.html',
  'blog/categories/talk-interview/index.html',
  'blog/categories/knowledge/index.html',
  'en/blog/categories/hoạt-động-1/index.html',
  'en/blog/categories/talk-interview-2/index.html',
  'en/blog/categories/knowledge-1/index.html',
];
const MAPPING_FILE = 'news/card-images.json';
const TARGET_WIDTH = 804;
const TARGET_HEIGHT = 452;
const MIN_REUSE_WIDTH = 800;
const DOWNLOAD_CONCURRENCY = 4;

function* descendants(node) {
  for (const child of node.childNodes || []) {
    yield child;
    yield* descendants(child);
  }
}

/** Gallery card image sources, exactly as the News tabs copy them from a category archive. */
export function collectArchiveCardSources(html) {
  const sources = [];
  for (const node of descendants(parse(html))) {
    if (node.tagName !== 'img') continue;
    const attrs = Object.fromEntries(node.attrs.map(item => [item.name, item.value]));
    if (attrs['data-hook'] === 'gallery-item-image-img' && attrs.src) sources.push(attrs.src);
  }
  return sources;
}

function mediaUri(remote) {
  const match = /\/media\/([^/?#]+)/.exec(remote);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

function fillSize(remote) {
  const match = /\/v1\/fill\/w_(\d+),h_(\d+)/.exec(remote);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

/** The only remote form we request: a centred 16:9 fill of the original, served by Wix's own media host. */
export function newsCardImageUrl(uri) {
  return `${originalMediaUrl(uri)}/v1/fill/w_${TARGET_WIDTH},h_${TARGET_HEIGHT},fp_0.50_0.50,q_90,enc_avif,quality_auto/${uri}`;
}

function localNameFor(url) {
  return `news-card-${createHash('sha256').update(url).digest('hex').slice(0, 24)}.avif`;
}

/**
 * Map each archive card's cropped image to a 16:9 image of the same photo.
 * Reuses a wide local 16:9 variant when the mirror already has one; otherwise schedules one download.
 */
export function planNewsCardImages(archiveHtml, assets) {
  const reverse = new Map(Object.entries(assets).map(([remote, local]) => [local, remote]));
  const variants = new Map();
  for (const [remote, local] of Object.entries(assets)) {
    const uri = mediaUri(remote);
    const size = fillSize(remote);
    if (!uri || !size || size.width < MIN_REUSE_WIDTH) continue;
    const ratio = size.width / size.height;
    if (ratio < 1.7 || ratio > 1.85) continue;
    const list = variants.get(uri) ?? [];
    list.push({ width: size.width, local });
    variants.set(uri, list);
  }
  const images = {};
  const downloads = new Map();
  const unresolved = [];
  for (const html of archiveHtml) {
    for (const src of collectArchiveCardSources(html)) {
      // Cards from the 21st on were never mirrored: their src is the remote Wix URL itself, so key by the full URL.
      const isRemote = /^https:\/\/static\.wixstatic\.com\/media\//.test(src);
      const basename = isRemote ? src : src.split('/').pop();
      if (images[basename]) continue;
      const remote = isRemote ? src : reverse.get(`/assets/${basename}`);
      const uri = remote && mediaUri(remote);
      if (!uri) { unresolved.push(basename); continue; }
      const reusable = (variants.get(uri) ?? []).sort((a, b) => a.width - b.width)[0];
      if (reusable) {
        images[basename] = reusable.local.split('/').pop();
        continue;
      }
      const url = newsCardImageUrl(uri);
      const local = localNameFor(url);
      downloads.set(uri, { uri, url, local });
      images[basename] = local;
    }
  }
  return { images, downloads: [...downloads.values()], unresolved };
}

async function downloadAll(items, fetchImpl) {
  const results = [];
  for (let offset = 0; offset < items.length; offset += DOWNLOAD_CONCURRENCY) {
    const batch = items.slice(offset, offset + DOWNLOAD_CONCURRENCY);
    results.push(...await Promise.all(batch.map(async item => {
      try {
        const response = await fetchImpl(item.url, {
          signal: AbortSignal.timeout(30000),
          redirect: 'error',
          headers: { Accept: 'image/avif,image/*,*/*;q=0.8' },
        });
        return { ...item, bytes: await imageBytes(response) };
      } catch (cause) {
        throw new Error(`Could not download news card image ${item.uri}: ${cause.message}`, { cause });
      }
    })));
  }
  return results;
}

/**
 * @param {{root?: string, fetchImpl?: typeof fetch, dryRun?: boolean}} options
 * @returns {Promise<{cards: number, reused: number, downloaded: number, unresolved: string[]}>}
 */
export async function restoreNewsCardImages({ root = DEFAULT_ROOT, fetchImpl = fetch, dryRun = false } = {}) {
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  // English archives are optional: a mirror without them still gets its Vietnamese cards.
  const archiveHtml = (await Promise.all(CATEGORY_ARCHIVES.map(file => readFile(path.join(root, file), 'utf8').catch(error => {
    if (error.code === 'ENOENT' && file.startsWith('en/')) return null;
    throw error;
  })))).filter(html => html !== null);
  const plan = planNewsCardImages(archiveHtml, manifest.assets);
  const missing = plan.downloads.filter(item => !manifest.assets[item.url]);
  const summary = {
    cards: Object.keys(plan.images).length,
    reused: Object.keys(plan.images).length - plan.downloads.length,
    downloaded: dryRun ? 0 : missing.length,
    toDownload: missing.length,
    unresolved: plan.unresolved,
  };
  if (dryRun) return summary;

  await mkdir(path.join(root, 'assets'), { recursive: true });
  const downloads = await downloadAll(missing, fetchImpl);
  await Promise.all(downloads.map(item => writeFile(path.join(root, 'assets', item.local), item.bytes)));
  const assets = { ...manifest.assets, ...Object.fromEntries(downloads.map(item => [item.url, `/assets/${item.local}`])) };
  if (downloads.length) await writeFile(manifestPath, JSON.stringify({ ...manifest, assets }, null, 2));
  await writeFile(path.join(root, MAPPING_FILE), `${JSON.stringify({ version: 1, images: plan.images }, null, 2)}\n`);
  return { ...summary, bytes: downloads.reduce((total, item) => total + item.bytes.length, 0) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  restoreNewsCardImages({ dryRun: process.argv.includes('--dry-run') })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
