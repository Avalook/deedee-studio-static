import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME_FILES = ['index.html', 'en/index.html'];
const IMAGE_LIMIT = 30 * 1024 * 1024;
const PROJECT_PREFIX = '/deedee-studio-static';

/** Construct the only supported remote source; arbitrary remote URLs are ignored. */
export function originalMediaUrl(uri) {
  if (typeof uri !== 'string' || !/^[a-zA-Z0-9_~.-]+\.(png|jpg|jpeg|webp|gif)$/i.test(uri)) {
    throw new Error('Invalid Wix media basename');
  }
  return `https://static.wixstatic.com/media/${uri}`;
}

/** Traverse parsed nodes without altering the source tree. */
function* descendants(node) {
  for (const child of node.childNodes || []) {
    yield child;
    yield* descendants(child);
  }
}

/** Read a parsed HTML attribute. */
function attribute(node, name) {
  return node.attrs?.find(item => item.name === name)?.value;
}

/** Discover only Wix images whose manifest source is explicitly blurred. */
export function collectPlaceholders(html, assets) {
  const reverse = new Map(Object.entries(assets).map(([remote, local]) => [local, remote]));
  const document = parse(html);
  const result = [];
  for (const node of descendants(document)) {
    if (node.tagName !== 'wow-image') continue;
    const metadata = attribute(node, 'data-image-info');
    if (!metadata) continue;
    const info = JSON.parse(metadata);
    for (const image of descendants(node)) {
      if (image.tagName !== 'img') continue;
      const src = attribute(image, 'src') || '';
      const old = src.startsWith(PROJECT_PREFIX + '/assets/') ? src.slice(PROJECT_PREFIX.length) : src;
      const remote = reverse.get(old);
      if (!remote?.includes('blur_')) continue;
      const uri = info?.imageData?.uri;
      originalMediaUrl(uri);
      result.push({ uri, old, remote });
    }
  }
  return result;
}

/** Replace exact local URL tokens, preserving project prefixes and other bytes. */
export function replaceAssetReferences(html, replacements) {
  return replacements.reduce((result, { old, local }) => {
    const escaped = old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const token = new RegExp(`${escaped}(?=$|[\\s"'<>),;?&#])`, 'g');
    return result.replace(token, () => local);
  }, html);
}

/** Read an image stream with an enforced bound even when Content-Length is absent. */
async function imageBytes(response) {
  if (!response.ok) throw new Error(`Original image returned HTTP ${response.status}`);
  if (!/^image\//i.test(response.headers.get('content-type') || '')) throw new Error('Original source is not an image');
  if (Number(response.headers.get('content-length')) > IMAGE_LIMIT) throw new Error('Original image exceeds size limit');
  if (!response.body) throw new Error('Original image has no body');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > IMAGE_LIMIT) {
        await reader.cancel();
        throw new Error('Original image exceeds size limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new Error('Original image is empty');
  return Buffer.concat(chunks, total);
}

/** Download all unique originals before any homepage or manifest is rewritten. */
async function downloadOriginals(placeholders, fetchImpl) {
  const unique = [...new Map(placeholders.map(item => [item.uri, item])).values()];
  const downloads = [];
  for (const item of unique) {
    const url = originalMediaUrl(item.uri);
    const hash = createHash('sha256').update(url).digest('hex').slice(0, 24);
    const local = `/assets/source-${hash}${path.extname(item.uri)}`;
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
      downloads.push({ uri: item.uri, url, local, bytes: await imageBytes(response) });
    } catch (cause) {
      throw new Error(`Could not restore original image ${item.uri}: ${cause.message}`, { cause });
    }
  }
  return downloads;
}

/**
 * Restore sharp originals used by VI/EN homepages and extend their asset manifest.
 * Dependency injection keeps integration tests local and deterministic.
 *
 * @param {{root?: string, fetchImpl?: typeof fetch}} options Site root and fetch.
 * @returns {Promise<{pagesChanged: number, placeholderOccurrences: number, restoredOriginals: number}>}
 */
export async function restorePlaceholderAssets({ root = DEFAULT_ROOT, fetchImpl = fetch } = {}) {
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const pages = await Promise.all(HOME_FILES.map(async file => ({ file, html: await readFile(path.join(root, file), 'utf8') })));
  const placeholders = pages.flatMap(page => collectPlaceholders(page.html, manifest.assets));
  if (!placeholders.length) return { pagesChanged: 0, placeholderOccurrences: 0, restoredOriginals: 0 };
  const downloads = await downloadOriginals(placeholders, fetchImpl);
  const byUri = new Map(downloads.map(item => [item.uri, item]));
  const replacements = [...new Map(placeholders.map(item => [item.old, { old: item.old, local: byUri.get(item.uri).local }])).values()];
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await Promise.all(downloads.map(item => writeFile(path.join(root, item.local), item.bytes)));
  let pagesChanged = 0;
  for (const page of pages) {
    const updated = replaceAssetReferences(page.html, replacements);
    if (updated === page.html) continue;
    await writeFile(path.join(root, page.file), updated);
    pagesChanged += 1;
  }
  const assets = { ...manifest.assets, ...Object.fromEntries(downloads.map(item => [item.url, item.local])) };
  await writeFile(manifestPath, JSON.stringify({ ...manifest, assets }, null, 2));
  return { pagesChanged, placeholderOccurrences: placeholders.length, restoredOriginals: downloads.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await restorePlaceholderAssets()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
