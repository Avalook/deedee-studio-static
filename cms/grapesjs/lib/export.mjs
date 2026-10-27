import fs from 'node:fs/promises';
import path from 'node:path';
import { validateSiteDocument } from './site-document.mjs';
import { syncSeo } from './seo-bake.mjs';
import { MEDIA_EXTENSIONS, mediaLayout } from './media.mjs';

/**
 * Publish a CMS release to the static archive.
 *
 * GitHub Pages cannot run the CMS, so "Publish" also writes what the static pages need:
 *   site-overrides.json    every approved page override, keyed by route
 *   assets/cms/<file>      uploaded images those overrides reference
 *   scripts/cms-runtime.js the same runtime the editor preview uses
 * The archived HTML is never edited; the pages apply the overrides when they load.
 */
export const STATIC_BASE_PATH = '/deedee-studio-static';
const UPLOADED = new RegExp(`/media/([a-f0-9-]{36}\\.(?:${MEDIA_EXTENSIONS}))`, 'gi');

export function collectPageDocuments(siteDocument) {
  const pages = {};
  const source = siteDocument?.pages && siteDocument.schemaVersion === 1 && !Array.isArray(siteDocument.pages)
    ? Object.values(siteDocument.pages)
    : siteDocument && siteDocument.pageId ? [siteDocument] : [];
  for (const candidate of source) {
    let document;
    try { document = validateSiteDocument(candidate); } catch { continue; }
    if (!document.operations.length && !document.insertions.length && !document.seo) continue;
    pages[document.pageId] = document;
  }
  return pages;
}

/**
 * Rewrite /media/<uuid>.png (served by the CMS) to where the public site will serve it: the website's own
 * assets/cms, or an absolute URL of the separate media repository when `mediaUrl(file)` is given.
 */
export function rewriteUploadedMedia(pages, basePath = STATIC_BASE_PATH, mediaUrl = null) {
  const files = new Set();
  const text = JSON.stringify(pages).replace(UPLOADED, (_match, file) => {
    files.add(file);
    return mediaUrl ? mediaUrl(file) : `${basePath}/assets/cms/${file}`;
  });
  return { pages: JSON.parse(text), files: [...files] };
}

async function writeAtomic(file, contents) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, contents);
  await fs.rename(temp, file);
}

export async function exportStaticSite({ release, outDir, uploadsDir, runtimeFile, basePath = STATIC_BASE_PATH, siteOrigin = process.env.CMS_SITE_ORIGIN || '', mediaRepo = null }) {
  const layout = mediaLayout({ outDir, media: mediaRepo });
  const collected = collectPageDocuments(release?.siteDocument);
  const { pages, files } = rewriteUploadedMedia(collected, basePath, layout.url);
  // Validate every dependency before changing the checkout; missing media must not leave a partial export.
  const media = await Promise.all(files.map(async (file) => {
    const buffer = await fs.readFile(path.join(uploadsDir, file)).catch(() =>
      fs.readFile(path.join(layout.root, layout.relative(file))).catch(() =>
        fs.readFile(path.join(outDir, 'assets', 'cms', file)).catch(() => null)));
    if (!buffer) throw new Error('Referenced upload is missing; restore it before publishing');
    return { file, buffer };
  }));
  const runtime = await fs.readFile(runtimeFile);
  const copied = [];
  for (const { file, buffer } of media) {
    await writeAtomic(path.join(layout.root, layout.relative(file)), buffer);
    copied.push(file);
  }
  const payload = {
    version: 1,
    revisionId: release?.revisionId ?? null,
    publishedAt: release?.publishedAt ?? null,
    publishedBy: release?.publishedBy ?? null,
    pages,
  };
  await writeAtomic(path.join(outDir, 'site-overrides.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await writeAtomic(path.join(outDir, 'scripts', 'cms-runtime.js'), runtime);
  // Title and description edits are also written into the pages' own <head> for search engines and link previews.
  const seoFiles = await syncSeo({ outDir, pages, siteOrigin, basePath });
  return {
    seo: Object.values(pages).filter((page) => page.seo).length,
    pages: Object.keys(pages).length,
    operations: Object.values(pages).reduce((total, page) => total + page.operations.length, 0),
    media: copied,
    // Paths relative to the media repository (empty when media lives in the website repository).
    mediaFiles: mediaRepo ? copied.map((file) => layout.relative(file)) : [],
    files: ['site-overrides.json', 'scripts/cms-runtime.js', ...(mediaRepo ? [] : copied.map((file) => layout.relative(file))), ...seoFiles.map((file) => file.split(path.sep).join('/'))],
  };
}
