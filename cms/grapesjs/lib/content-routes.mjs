import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { HttpError, readJson, sendJson, sendHtml, redirect, escapeHtml } from './http.mjs';
import { exportContent } from './content-export.mjs';
import { commitAndPush } from './git-publish.mjs';
import { syncRepository } from './hosted-repository.mjs';
import { loadArticleTemplates } from './article-template.mjs';
import { renderContentPage } from './content-render.mjs';

const ID = 'content_[a-f0-9-]{36}';

/** Structured content endpoints reuse the existing session, CSRF and publish queue. */
export function createContentRoutes({ contentStore, requireSession, requireCsrf, requirePublisher,
  enqueuePublish, outDir, uploadsDir, sourceDir, publicDir, reservedRoutes,
  pushEnabled, hosted, exportEnabled }) {
  // The site's article pages are read once and used as the layout of CMS articles.
  let templates;
  const articleTemplates = async () => { templates ??= await loadArticleTemplates(sourceDir).catch(() => ({})); return templates; };
  const render = async (item, options) => renderContentPage(item, { ...options, templates: await articleTemplates() });

  async function publish(id, remove, actor) {
    return enqueuePublish(async () => {
      const item = await contentStore.get(id);
      const previousItems = await contentStore.published();
      const snapshot = remove ? null : Object.fromEntries(Object.entries(item).filter(([key]) =>
        !['createdAt', 'updatedAt', 'status', 'isPublished', 'hasUnpublishedChanges', 'publishedItem', 'firstPublishedAt'].includes(key)));
      const items = [...previousItems.filter((entry) => entry.id !== id), ...(snapshot ? [snapshot] : [])];
      if (!exportEnabled) throw new HttpError(409, 'Static export is disabled', 'EXPORT_DISABLED');
      let exported;
      try {
        if (pushEnabled) await syncRepository(outDir);
        const pageTemplates = await articleTemplates();
        const renderer = (item, options) => renderContentPage(item, { ...options, templates: pageTemplates });
        exported = await exportContent({ items, previousItems, outDir, uploadsDir, sourceDir,
          renderPage: renderer, reservedRoutes });
        if (pushEnabled) exported.git = await commitAndPush({ repoDir: outDir, files: exported.files,
          message: `cms: ${remove ? 'unpublish' : 'publish'} content ${id} by ${actor}` });
      } catch (error) {
        if (error.message === 'Published catalog changed on another machine; reconcile before publishing') {
          throw new HttpError(409, 'Another machine published newer content. Reconcile the shared catalog before publishing.', 'CONTENT_STALE');
        }
        throw new HttpError(502, 'Content was saved, but export or Git publication failed. Check media and repository access before retrying.', 'PUBLISH_FAILED');
      }
      const updated = await contentStore.commitPublication(id, snapshot);
      return { item: updated, export: exported };
    });
  }

  return async function contentRoutes(req, res, url) {
    const pathname = url.pathname;
    if (pathname === '/admin/content' || pathname === '/admin/content/') {
      try { requireSession(req); } catch { redirect(res, '/admin/login', 302); return true; }
      sendHtml(res, 200, await readFile(path.join(publicDir, 'admin', 'content.html'), 'utf8'));
      return true;
    }
    const preview = pathname.match(new RegExp(`^/admin/content/(${ID})/preview$`));
    if (preview) {
      requireSession(req);
      const item = await contentStore.get(preview[1]);
      res.setHeader('Cache-Control', 'private, no-store');
      const html = await render(item, { basePath: '' });
      sendHtml(res, 200, html.replace(/<body([^>]*)>/i, `<body$1><p style="padding:12px;background:#eef2ff"><a href="/admin/content?id=${escapeHtml(item.id)}">← Quay lại quản lý nội dung · Bản xem trước chưa xuất bản</a></p>`)); return true;
    }
    const match = pathname.match(new RegExp(`^/api/content(?:/(${ID})(?:/(publish|unpublish))?)?$`));
    if (pathname.startsWith('/api/content') && !match) throw new HttpError(404, 'Content route not found', 'NOT_FOUND');
    if (match) {
      const session = requireSession(req); const [, id, action] = match;
      if (req.method === 'GET' && !action) {
        sendJson(res, 200, id ? { item: await contentStore.get(id) } : { items: await contentStore.list() }); return true;
      }
      requireCsrf(req, session);
      if (req.method === 'POST' && action) {
        requirePublisher(session);
        sendJson(res, 200, await publish(id, action === 'unpublish', session.user.username)); return true;
      }
      if ((req.method === 'POST' && !id) || (req.method === 'PUT' && id && !action)) {
        const body = await readJson(req, 300_000);
        // Draft route changes must not race an in-flight first publication.
        const item = await enqueuePublish(() => id ? contentStore.update(id, body?.item ?? body) : contentStore.create(body?.item ?? body));
        sendJson(res, id ? 200 : 201, { item }); return true;
      }
      throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const route = pathname.replace(/^\/deedee-studio-static(?=\/|$)/, '').replace(/\/$/, '') || '/';
    const runtimeFile = route.match(/^\/scripts\/(content-cards\.(?:mjs|css)|site-controls\.mjs)$/);
    if (runtimeFile) {
      const contents = await readFile(path.join(sourceDir, 'scripts', runtimeFile[1]));
      res.writeHead(200, { 'Content-Type': route.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(contents); return true;
    }
    if (route === '/content.json') {
      res.setHeader('Cache-Control', 'no-cache');
      sendJson(res, 200, { version: 1, items: await contentStore.published() }); return true;
    }
    const item = (await contentStore.published()).find((entry) => entry.route === route);
    if (item) { sendHtml(res, 200, await render(item, { basePath: '' })); return true; }
    return false;
  };
}
