import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { rewriteUploadedMedia, STATIC_BASE_PATH } from './export.mjs';

const RUNTIME = ['content-cards.mjs', 'content-cards.css', 'site-controls.mjs'];
const ROUTE = /^\/(?:en\/)?(?:post|all-project)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pageFile(item) {
  if (!ROUTE.test(item.route)) throw new Error('Invalid generated content route');
  return `${item.route.slice(1)}/index.html`;
}

async function atomic(file, contents) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`; await writeFile(temporary, contents); await rename(temporary, file);
}

/** Export only public snapshots and exact owned paths; private data is never staged. */
export async function exportContent({ items, previousItems = [], outDir, uploadsDir, sourceDir,
  renderPage, basePath = STATIC_BASE_PATH, reservedRoutes = [] }) {
  const reserved = new Set(reservedRoutes);
  for (const item of [...items, ...previousItems]) {
    pageFile(item);
    if (reserved.has(item.route)) throw new Error('Content export cannot replace archived pages');
  }
  const { pages, files: uploaded } = rewriteUploadedMedia(items, basePath);
  // Another CMS may have published since this machine loaded its private snapshot.
  // Refuse a stale catalog rather than delete or overwrite someone else's content.
  const stable = (entries) => JSON.stringify(entries.slice().sort((a, b) => a.id.localeCompare(b.id)));
  let existing;
  try { existing = JSON.parse(await readFile(path.join(outDir, 'content.json'), 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing && (existing.version !== 1 || !Array.isArray(existing.items))) throw new Error('Invalid existing content catalog');
  if (existing) {
    const prior = rewriteUploadedMedia(previousItems, basePath).pages;
    if (stable(existing.items) !== stable(prior) && stable(existing.items) !== stable(pages)) {
      throw new Error('Published catalog changed on another machine; reconcile before publishing');
    }
  }
  const media = await Promise.all(uploaded.map(async (file) => {
    const buffer = await readFile(path.join(uploadsDir, file)).catch(() => readFile(path.join(outDir, 'assets', 'cms', file)).catch(() => null));
    if (!buffer) throw new Error('Referenced upload is missing; restore it before publishing');
    return { name: `assets/cms/${file}`, contents: buffer };
  }));
  const runtime = await Promise.all(RUNTIME.map(async (name) => ({ name: `scripts/${name}`, contents: await readFile(path.join(sourceDir, 'scripts', name)) })));
  const generated = pages.map((item) => ({ name: pageFile(item), contents: renderPage(item, { basePath }) }));
  const catalog = { name: 'content.json', contents: `${JSON.stringify({ version: 1, items: pages }, null, 2)}\n` };
  const nextRoutes = new Set(items.map((item) => item.route));
  const removed = previousItems.filter((item) => !nextRoutes.has(item.route)).map(pageFile);
  for (const file of [...media, ...runtime, ...generated, catalog]) await atomic(path.join(outDir, file.name), file.contents);
  for (const file of removed) await unlink(path.join(outDir, file)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  return { enabled: true, items: pages.length, removed, files: [...new Set([...media, ...runtime, ...generated, catalog].map((file) => file.name).concat(removed))] };
}
