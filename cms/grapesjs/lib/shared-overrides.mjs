import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { collectPageDocuments, STATIC_BASE_PATH } from './export.mjs';
import { remoteFile } from './hosted-repository.mjs';
import { detectMedia, MEDIA_EXTENSIONS } from './media.mjs';

/**
 * site-overrides.json on main is the shared record of what is published. Each CMS install keeps its own store, so an
 * install must adopt that record when it starts: its first publish would otherwise replace every earlier edit.
 */
const OVERRIDES_FILE = 'site-overrides.json';
const CONTENT_FILE = 'content.json';
const PUBLISHED_MEDIA = new RegExp(`${STATIC_BASE_PATH}/assets/cms/([a-f0-9-]{36}\\.(?:${MEDIA_EXTENSIONS}))`, 'gi');

/** Undo rewriteUploadedMedia so that adopted documents use the /media/ references the editor understands. */
export function localisePublishedMedia(pages) {
  const files = new Set();
  const text = JSON.stringify(pages).replace(PUBLISHED_MEDIA, (_match, file) => { files.add(file); return `/media/${file}`; });
  return { pages: JSON.parse(text), files: [...files] };
}

export function parsePublished(text) {
  let value;
  try { value = JSON.parse(text); } catch { return null; }
  return value && typeof value.revisionId === 'string' ? value : null;
}

/** Published media stays usable in the editor preview, which serves /media/ from this store. */
async function adoptPublishedMedia({ store, files, outDir }) {
  for (const file of files) {
    const buffer = await readFile(path.join(outDir, 'assets', 'cms', file)).catch(() => null);
    const type = buffer && detectMedia(buffer)?.mime;
    if (type) await store.adoptAsset({ file, buffer, type });
  }
}

/** Bring a published record made elsewhere into this store. Returns the adopted revision id, or null if there is none. */
export async function adoptPublishedOverrides({ store, outDir }) {
  const text = await readFile(path.join(outDir, OVERRIDES_FILE), 'utf8').catch(() => '');
  const published = parsePublished(text);
  if (!published) return null;
  if ((await store.getPublishedRelease())?.revisionId === published.revisionId) return null;
  const { pages, files } = localisePublishedMedia(published.pages || {});
  const documents = collectPageDocuments({ schemaVersion: 1, pages });
  await adoptPublishedMedia({ store, files, outDir });
  await store.adoptRelease({ revisionId: published.revisionId, publishedAt: published.publishedAt,
    publishedBy: published.publishedBy, pages: documents });
  return published.revisionId;
}

/** The same for articles and projects: content.json on main is the shared record of what is published. */
export async function adoptPublishedContent({ store, contentStore, outDir }) {
  const text = await readFile(path.join(outDir, CONTENT_FILE), 'utf8').catch(() => '');
  let catalog;
  try { catalog = JSON.parse(text); } catch { return; }
  if (catalog?.version !== 1 || !Array.isArray(catalog.items)) return;
  const { pages: items, files } = localisePublishedMedia(catalog.items);
  await adoptPublishedMedia({ store, files, outDir });
  await contentStore.adoptCatalog(items);
}

/** True when main holds a publication this store has not seen. Call after syncRepository. */
export async function publishedElsewhere({ store, repoDir }) {
  const published = parsePublished(await remoteFile(repoDir, OVERRIDES_FILE));
  return Boolean(published) && published.revisionId !== (await store.getPublishedRelease())?.revisionId;
}
