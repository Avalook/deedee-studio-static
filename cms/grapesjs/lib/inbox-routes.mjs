import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { HttpError, readJson, sendJson, sendHtml, sendText, redirect } from './http.mjs';
import { KINDS, SupabaseError, toCsv } from './supabase-admin.mjs';

const ITEM = /^\/api\/inbox\/(forms|comments)\/([a-f0-9-]{36})$/i;

/** Contact-form submissions and comments, for publishers and admins only (they contain visitors' personal data). */
export function createInboxRoutes({ requireSession, requireCsrf, requirePublisher, publicDir, admin }) {
  const guard = (req) => { const session = requireSession(req); requirePublisher(session); return session; };
  const fail = (error) => {
    if (error instanceof SupabaseError) throw new HttpError(error.status === 400 ? 400 : 502, error.message, 'SUPABASE_ERROR');
    throw error;
  };
  const kindOf = (url) => {
    const kind = url.searchParams.get('kind') || 'forms';
    if (!KINDS[kind]) throw new HttpError(400, 'Loại dữ liệu không hợp lệ', 'INVALID_KIND');
    return kind;
  };
  const statusOf = (url) => ['pending', 'done', 'all'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'pending';

  return async function inboxRoutes(req, res, url) {
    const pathname = url.pathname;
    if (pathname === '/admin/submissions' || pathname === '/admin/submissions/') {
      try { requireSession(req); } catch { redirect(res, '/admin/login', 302); return true; }
      sendHtml(res, 200, await readFile(path.join(publicDir, 'admin', 'submissions.html'), 'utf8'));
      return true;
    }
    if (!pathname.startsWith('/api/inbox')) return false;
    const session = guard(req);
    if (pathname === '/api/inbox' && req.method === 'GET') {
      if (!admin) { sendJson(res, 200, { configured: false, items: [], total: 0 }); return true; }
      try {
        sendJson(res, 200, { configured: true, ...(await admin.list(kindOf(url), { status: statusOf(url), page: url.searchParams.get('page') })) });
      } catch (error) { fail(error); }
      return true;
    }
    if (pathname === '/api/inbox/export.csv' && req.method === 'GET') {
      if (!admin) throw new HttpError(409, 'Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY', 'NOT_CONFIGURED');
      const kind = kindOf(url);
      try {
        const rows = await admin.listAll(kind, { status: statusOf(url) });
        sendText(res, 200, toCsv(kind, rows), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="deedee-${kind}.csv"` });
      } catch (error) { fail(error); }
      return true;
    }
    const item = pathname.match(ITEM);
    if (item) {
      if (!admin) throw new HttpError(409, 'Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY', 'NOT_CONFIGURED');
      requireCsrf(req, session);
      const [, kind, id] = item;
      try {
        if (req.method === 'PATCH') {
          const body = await readJson(req, 1024);
          if (typeof body?.done !== 'boolean') throw new HttpError(400, 'done must be true or false', 'INVALID_BODY');
          await admin.setDone(kind, id, body.done);
          sendJson(res, 200, { ok: true });
          return true;
        }
        if (req.method === 'DELETE') { await admin.remove(kind, id); sendJson(res, 200, { ok: true }); return true; }
      } catch (error) { fail(error); }
      throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
    }
    throw new HttpError(404, 'API route not found', 'NOT_FOUND');
  };
}
