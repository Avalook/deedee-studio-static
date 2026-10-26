import fs from 'node:fs/promises';
import path from 'node:path';
import { validateSiteDocument } from './site-document.mjs';

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
const UPLOADED = /\/media\/([a-f0-9-]{36}\.(?:png|jpe?g|webp|gif))/gi;

export function collectPageDocuments(siteDocument) {
  const pages = {};
  const source = siteDocument?.pages && siteDocument.schemaVersion === 1 && !Array.isArray(siteDocument.pages)
    ? Object.values(siteDocument.pages)
    : siteDocument && siteDocument.pageId ? [siteDocument] : [];
  for (const candidate of source) {
    let document;
    try { document = validateSiteDocument(candidate); } catch { continue; }
    if (!document.operations.length && !document.insertions.length) continue;
    pages[document.pageId] = document;
  }
  return pages;
}

/** Rewrite /media/<uuid>.png (served by the CMS) to the path the static site will serve. */
export function rewriteUploadedMedia(pages, basePath = STATIC_BASE_PATH) {
  const files = new Set();
  const text = JSON.stringify(pages).replace(UPLOADED, (_match, file) => {
    files.add(file);
    return `${basePath}/assets/cms/${file}`;
  });
  return { pages: JSON.parse(text), files: [...files] };
}

async function writeAtomic(file, contents) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, contents);
  await fs.rename(temp, file);
}

export async function exportStaticSite({ release, outDir, uploadsDir, runtimeFile, basePath = STATIC_BASE_PATH }) {
  const collected = collectPageDocuments(release?.siteDocument);
  const { pages, files } = rewriteUploadedMedia(collected, basePath);
  const copied = [];
  for (const file of files) {
    const buffer = await fs.readFile(path.join(uploadsDir, file)).catch(() => null);
    if (!buffer) continue;
    await writeAtomic(path.join(outDir, 'assets', 'cms', file), buffer);
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
  await writeAtomic(path.join(outDir, 'scripts', 'cms-runtime.js'), await fs.readFile(runtimeFile));
  return {
    pages: Object.keys(pages).length,
    operations: Object.values(pages).reduce((total, page) => total + page.operations.length, 0),
    media: copied,
    files: ['site-overrides.json', 'scripts/cms-runtime.js', ...copied.map((file) => `assets/cms/${file}`)],
  };
}
