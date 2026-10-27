import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateContent } from './content-schema.mjs';
import { HttpError } from './http.mjs';
import { createPublishQueue } from './publish-queue.mjs';

function view(record) {
  const changed = Boolean(record.published && JSON.stringify(record.draft) !== JSON.stringify(record.published));
  return structuredClone({ ...record.draft, createdAt: record.createdAt, updatedAt: record.updatedAt,
    isPublished: Boolean(record.published), hasUnpublishedChanges: changed, firstPublishedAt: record.firstPublishedAt || null,
    status: record.published ? changed ? 'changed' : 'published' : 'draft', publishedItem: record.published });
}

/** Private durable drafts and independent published snapshots for one CMS instance. */
export async function createContentStore({ dataDir, staticSiteDir, reservedRoutes = [], publicCatalogFile }) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const file = path.join(dataDir, 'content-store.json');
  let state;
  try { state = JSON.parse(await readFile(file, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    let imported = [];
    if (publicCatalogFile) {
      try {
        const catalog = JSON.parse(await readFile(publicCatalogFile, 'utf8'));
        if (catalog.version !== 1 || !Array.isArray(catalog.items)) throw new Error('Invalid public catalog');
        imported = catalog.items.map((item) => {
          if (!/^content_[a-f0-9-]{36}$/.test(item.id)) throw new Error('Invalid public content identity');
          const snapshot = { ...validateContent(item), id: item.id };
          if (reservedRoutes.includes(snapshot.route)) throw new Error('Public content collides with archived route');
          return { draft: snapshot, published: snapshot, lockedRoute: snapshot.route,
            firstPublishedAt: snapshot.publishedAt, createdAt: snapshot.publishedAt, updatedAt: snapshot.publishedAt };
        });
      } catch (catalogError) { if (catalogError.code !== 'ENOENT') throw catalogError; }
    }
    state = { version: 1, records: imported };
  }
  if (state.version !== 1 || !Array.isArray(state.records)) throw new Error('Invalid private content store');
  const lock = createPublishQueue();
  const reserved = new Set(reservedRoutes.map((route) => route.replace(/\/$/, '') || '/'));
  async function persist(next) {
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, file); state = next;
  }
  function recordFor(id) {
    const record = state.records.find((entry) => entry.draft.id === id);
    if (!record) throw new HttpError(404, 'Content item not found', 'NOT_FOUND');
    return record;
  }
  async function available(item, own) {
    if (reserved.has(item.route) || state.records.some((entry) => entry.draft.id !== own?.draft.id &&
      [entry.draft.route, entry.published?.route, entry.lockedRoute].includes(item.route))) {
      throw new HttpError(409, 'This route is already used', 'ROUTE_CONFLICT');
    }
    if (own?.lockedRoute && item.route !== own.lockedRoute) throw new HttpError(409, 'Published route cannot change', 'ROUTE_CONFLICT');
    if (own?.lockedRoute === item.route) return;
    try { await access(path.join(staticSiteDir, item.route.slice(1), 'index.html')); } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    throw new HttpError(409, 'This route already belongs to an existing page', 'ROUTE_CONFLICT');
  }
  return {
    async list() { return state.records.map(view); },
    async get(id) { return view(recordFor(id)); },
    async published() { return structuredClone(state.records.filter((record) => record.published).map((record) => record.published)); },
    async create(input) {
      return lock(async () => {
        const draft = { ...validateContent(input), id: `content_${randomUUID()}` }; await available(draft);
        const now = new Date().toISOString(); const record = { draft, published: null, lockedRoute: null, createdAt: now, updatedAt: now };
        await persist({ ...state, records: [...state.records, record] }); return view(record);
      });
    },
    async update(id, input) {
      return lock(async () => {
        const current = recordFor(id); const draft = { ...validateContent(input, current.draft), id };
        await available(draft, current);
        const next = { ...current, draft, updatedAt: new Date().toISOString() };
        await persist({ ...state, records: state.records.map((record) => record === current ? next : record) }); return view(next);
      });
    },
    async commitPublication(id, snapshot) {
      return lock(async () => {
        const current = recordFor(id);
        const published = snapshot ? { ...validateContent(snapshot, current.draft), id } : null;
        if (published) {
          if (published.route !== current.draft.route) throw new HttpError(409, 'Draft route changed during publication', 'ROUTE_CONFLICT');
          await available(published, { ...current, lockedRoute: published.route });
        }
        const next = { ...current, published, lockedRoute: published?.route || current.lockedRoute,
          firstPublishedAt: current.firstPublishedAt || (published ? new Date().toISOString() : null) };
        await persist({ ...state, records: state.records.map((record) => record === current ? next : record) }); return view(next);
      });
    },
    async isAssetPublished(filename) {
      return state.records.some((record) => record.published && JSON.stringify(record.published).includes(`/media/${filename}`));
    },
  };
}
