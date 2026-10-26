import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME_FILES = ['index.html', 'en/index.html'];
const IMAGE_LIMIT = 30 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 3500;
const IMAGE_QUALITY = 90;
const DOWNLOAD_CONCURRENCY = 6;
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

/** Real Wix data-image-info stores hasAnimation at the top level; fall back to the legacy nested field. */
function animationFlag(info) {
  if (info?.hasAnimation !== undefined) return info.hasAnimation === true;
  return info?.imageData?.hasAnimation === true;
}

/** True when a manifest remote URL serves the given Wix media basename. */
function remoteServesUri(remote, uri) {
  const tail = remote.split('/').pop();
  if (tail === uri) return true;
  try {
    return decodeURIComponent(tail) === uri;
  } catch {
    return false;
  }
}

/** Candidate URLs inside an img src or a source srcset list. */
function candidateUrls(tagName, value) {
  if (tagName === 'img') return [value];
  return value.split(',').map(entry => entry.trim().split(/\s+/)[0]).filter(Boolean);
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
    const imageData = info?.imageData;
    const uri = imageData?.uri;
    const byOld = new Map();
    for (const image of descendants(node)) {
      const value = image.tagName === 'img'
        ? attribute(image, 'src')
        : image.tagName === 'source' ? attribute(image, 'srcset') : undefined;
      if (value === undefined) continue;
      for (const candidate of candidateUrls(image.tagName, value)) {
        const old = candidate.startsWith(PROJECT_PREFIX + '/assets/') ? candidate.slice(PROJECT_PREFIX.length) : candidate;
        const remote = reverse.get(old);
        if (!remote?.includes('blur_')) continue;
        if (image.tagName === 'source' && !remoteServesUri(remote, uri)) continue;
        originalMediaUrl(uri);
        if (!byOld.has(old)) {
          byOld.set(old, {
            uri,
            old,
            remote,
            width: imageData.width,
            height: imageData.height,
            hasAnimation: animationFlag(info),
          });
        }
      }
    }
    result.push(...byOld.values());
  }
  return result;
}

/** Find blank Wix image tags whose original media URI is still in image metadata. */
export function collectMissingImageSources(html) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const result = [];
  for (const node of descendants(document)) {
    if (node.tagName !== 'wow-image') continue;
    const metadata = attribute(node, 'data-image-info');
    if (!metadata) continue;
    const info = JSON.parse(metadata);
    const imageData = info?.imageData;
    if (!imageData?.uri) continue;
    originalMediaUrl(imageData.uri);
    for (const image of descendants(node)) {
      if (image.tagName !== 'img' || attribute(image, 'src') !== '') continue;
      const location = image.sourceCodeLocation?.attrs?.src;
      if (!location) continue;
      const sourceAttribute = html.slice(location.startOffset, location.endOffset);
      if (!/^src\s*=\s*(["'])\1$/i.test(sourceAttribute)) continue;
      result.push({
        uri: imageData.uri,
        width: imageData.width,
        height: imageData.height,
        hasAnimation: animationFlag(info),
        start: location.startOffset,
        end: location.endOffset,
      });
    }
  }
  return result;
}

/** Fill only source attributes that were confirmed empty by collectMissingImageSources. */
export function replaceMissingImageSources(html, replacements) {
  return [...replacements]
    .sort((left, right) => right.start - left.start)
    .reduce((result, replacement) => {
      const sourceAttribute = result.slice(replacement.start, replacement.end);
      const match = /^(src\s*=\s*)(["'])\2$/i.exec(sourceAttribute);
      if (!match) return result;
      const updatedAttribute = `${match[1]}${match[2]}${replacement.local}${match[2]}`;
      return result.slice(0, replacement.start) + updatedAttribute + result.slice(replacement.end);
    }, html);
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

/** Download bounded-size variants before any manifest route is rewritten. */
async function downloadOriginals(placeholders, fetchImpl) {
  const unique = [...new Map(placeholders.map(item => [item.uri, item])).values()];
  const download = async item => {
    const originalUrl = originalMediaUrl(item.uri);
    const preservesAnimation = item.hasAnimation || /\.gif$/i.test(item.uri);
    const sourceWidth = Number.isFinite(item.width) && item.width > 0
      ? item.width
      : MAX_IMAGE_DIMENSION;
    const sourceHeight = Number.isFinite(item.height) && item.height > 0
      ? item.height
      : MAX_IMAGE_DIMENSION;
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight),
    );
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const url = preservesAnimation
      ? originalUrl
      : `${originalUrl}/v1/fit/w_${width},h_${height},q_${IMAGE_QUALITY},enc_avif,quality_auto/${item.uri}`;
    const extension = preservesAnimation ? path.extname(item.uri) : '.avif';
    const hash = createHash('sha256').update(url).digest('hex').slice(0, 24);
    const local = `/assets/source-${hash}${extension}`;
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(30000),
        redirect: 'error',
        headers: { Accept: preservesAnimation ? 'image/*,*/*;q=0.8' : 'image/avif,image/*,*/*;q=0.8' },
      });
      return { uri: item.uri, url, local, bytes: await imageBytes(response) };
    } catch (cause) {
      throw new Error(`Could not restore image ${item.uri}: ${cause.message}`, { cause });
    }
  };
  const downloads = [];
  for (let offset = 0; offset < unique.length; offset += DOWNLOAD_CONCURRENCY) {
    const batch = unique.slice(offset, offset + DOWNLOAD_CONCURRENCY);
    downloads.push(...await Promise.all(batch.map(download)));
  }
  return downloads;
}

/**
 * Restore sharp Wix images used by manifest routes and extend their asset manifest.
 * Dependency injection keeps integration tests local and deterministic.
 *
 * @param {{root?: string, fetchImpl?: typeof fetch}} options Site root and fetch.
 * @returns {Promise<{pagesChanged: number, placeholderOccurrences: number, restoredOriginals: number}>}
 */
export async function restorePlaceholderAssets({ root = DEFAULT_ROOT, fetchImpl = fetch } = {}) {
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const pageFiles = Array.isArray(manifest.pages)
    ? [...new Set(manifest.pages.map(page => page.file))]
    : HOME_FILES;
  if (pageFiles.some(file =>
    typeof file !== 'string' ||
    path.isAbsolute(file) ||
    file.split(/[\\/]/).includes('..')
  )) {
    throw new Error('Manifest contains an unsafe page file path');
  }
  const pages = await Promise.all(pageFiles.map(async file => ({
    file,
    html: await readFile(path.join(root, file), 'utf8'),
  })));
  const placeholders = pages.flatMap(page => collectPlaceholders(page.html, manifest.assets));
  const missingSources = pages.flatMap(page => collectMissingImageSources(page.html));
  const candidates = [...placeholders, ...missingSources];
  if (!candidates.length) {
    return { pagesChanged: 0, placeholderOccurrences: 0, missingImageSources: 0, restoredOriginals: 0 };
  }
  const downloads = await downloadOriginals(candidates, fetchImpl);
  const byUri = new Map(downloads.map(item => [item.uri, item]));
  const replacements = [...new Map(placeholders.map(item => [item.old, { old: item.old, local: byUri.get(item.uri).local }])).values()];
  const projectPrefix = pages.some(page => page.html.includes('="/deedee-studio-static/assets/'))
    ? PROJECT_PREFIX
    : '';
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await Promise.all(downloads.map(item => writeFile(path.join(root, item.local), item.bytes)));
  let pagesChanged = 0;
  for (const page of pages) {
    const missingReplacements = collectMissingImageSources(page.html).map(item => ({
      ...item,
      local: `${projectPrefix}${byUri.get(item.uri).local}`,
    }));
    const completedSources = replaceMissingImageSources(page.html, missingReplacements);
    const updated = replaceAssetReferences(completedSources, replacements);
    if (updated === page.html) continue;
    await writeFile(path.join(root, page.file), updated);
    pagesChanged += 1;
  }
  const assets = { ...manifest.assets, ...Object.fromEntries(downloads.map(item => [item.url, item.local])) };
  await writeFile(manifestPath, JSON.stringify({ ...manifest, assets }, null, 2));
  return {
    pagesChanged,
    placeholderOccurrences: placeholders.length,
    missingImageSources: missingSources.length,
    restoredOriginals: downloads.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await restorePlaceholderAssets()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
