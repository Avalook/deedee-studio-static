import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';

import {
  DATA_DIR,
  DEMO_USERS,
  HOSTED,
  GRAPES_DIST,
  HOST,
  LIMITS,
  MAX_JSON_BYTES,
  MAX_UPLOAD_BYTES,
  PORT,
  EXPORT_DIR,
  EXPORT_ENABLED,
  GIT_PUSH_ENABLED,
  PREVIEW_TTL_MS,
  PUBLIC_DIR,
  SEED_DIR,
  SESSION_TTL_MS,
  SHARED_DIR,
  STATIC_SITE_ORIGIN,
  STATIC_SITE_DIR,
} from './lib/config.mjs';
import {
  clearPreviewCookie,
  clearSessionCookie,
  createLoginLimiter,
  createSessionStore,
  parseCookies,
  serializePreviewCookie,
  serializeSessionCookie,
  signPreviewToken,
  verifyPreviewToken, hashSessionToken } from './lib/auth.mjs';
import { createStore, StoreConflictError, UserError } from './lib/store.mjs';
import { createArchiveProxy } from './lib/archive-proxy.mjs';
import { ContentPolicyError, sanitizeCss, sanitizeHtml } from './lib/sanitize.mjs';
import { validateSiteDocument } from './lib/site-document.mjs';
import { manifestRoutes, normalizePageIdFromUrl, siteDocumentFor, withPageDocument } from './lib/site-pages.mjs';
import { exportStaticSite } from './lib/export.mjs';
import { commitAndPush } from './lib/git-publish.mjs';
import { validateHostedEnvironment, assertHostedUsers } from './lib/hosted-config.mjs';
import { syncRepository } from './lib/hosted-repository.mjs';
import { createPublishQueue } from './lib/publish-queue.mjs';
import { createContentStore } from './lib/content-store.mjs';
import { createContentRoutes } from './lib/content-routes.mjs';
import {
  escapeHtml,
  getClientIp,
  HttpError,
  readBody,
  readJson,
  redirect,
  sendHtml,
  sendJson,
  sendText,
} from './lib/http.mjs';
import { renderErrorPage, renderPreviewPage, renderPublicPage } from './lib/render.mjs';

const PUBLIC_CSP =
  "default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'none'; connect-src 'none'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const ADMIN_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
};

validateHostedEnvironment();
await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });

async function loadSecret() {
  if (process.env.POC_SECRET && process.env.POC_SECRET.length >= 32) {
    return process.env.POC_SECRET;
  }
  const secretFile = path.join(DATA_DIR, 'secret.key');
  try {
    const existing = (await fs.readFile(secretFile, 'utf8')).trim();
    if (existing.length >= 32) return existing;
  } catch {
    // Generate below.
  }
  const secret = randomBytes(32).toString('hex');
  await fs.writeFile(secretFile, `${secret}\n`, { mode: 0o600 });
  return secret;
}

const secret = await loadSecret();
const store = await createStore({ dataDir: DATA_DIR, seedDir: SEED_DIR, demoUsers: DEMO_USERS });
if (HOSTED) assertHostedUsers(JSON.parse(await fs.readFile(path.join(DATA_DIR, 'users.json'), 'utf8')).users);
const enqueuePublish = createPublishQueue();
const contentManifest = JSON.parse(await fs.readFile(path.join(STATIC_SITE_DIR, 'manifest.json'), 'utf8'));
const reservedContentRoutes = (contentManifest.pages || []).map((page) => page.route);
const contentStore = await createContentStore({ dataDir: DATA_DIR, staticSiteDir: STATIC_SITE_DIR,
  reservedRoutes: reservedContentRoutes, publicCatalogFile: path.join(EXPORT_DIR, 'content.json') });
const contentRoutes = createContentRoutes({ contentStore, requireSession, requireCsrf, requirePublisher,
  enqueuePublish, outDir: EXPORT_DIR, uploadsDir: path.join(DATA_DIR, 'uploads'),
  sourceDir: STATIC_SITE_DIR, publicDir: PUBLIC_DIR, reservedRoutes: reservedContentRoutes,
  pushEnabled: GIT_PUSH_ENABLED, hosted: HOSTED, exportEnabled: EXPORT_ENABLED });
const archiveProxy = createArchiveProxy({
  staticSiteOrigin: STATIC_SITE_ORIGIN,
  host: HOST,
  port: PORT,
  verifyPreviewToken,
  secret,
  serializePreviewCookie: (token, maxAge) => serializePreviewCookie(token, maxAge, HOSTED),
  HttpError,
});
const sessions = createSessionStore({ ttlMs: SESSION_TTL_MS });
const loginLimiter = createLoginLimiter();

function setBaselineHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function setCsp(res, csp) {
  res.setHeader('Content-Security-Policy', csp);
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return sessions.get(cookies.poc_session || '');
}

function requireSession(req) {
  const session = getSession(req);
  if (!session) throw new HttpError(401, 'Login required', 'UNAUTHENTICATED');
  return session;
}

function requireCsrf(req, session) {
  const supplied = req.headers['x-csrf-token'];
  if (typeof supplied !== 'string') {
    throw new HttpError(403, 'Missing CSRF token', 'CSRF_REJECTED');
  }
  const a = Buffer.from(supplied);
  const b = Buffer.from(session.csrf);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(403, 'Invalid CSRF token', 'CSRF_REJECTED');
  }
}

function requirePublisher(session) {
  // Admins can do everything a publisher can.
  if (!['publisher', 'admin'].includes(session.user.role)) {
    throw new HttpError(403, 'Publisher role required', 'FORBIDDEN');
  }
}

function requireAdmin(session) {
  if (session.user.role !== 'admin') {
    throw new HttpError(403, 'Admin role required', 'FORBIDDEN');
  }
}

/** Account endpoints: /api/users (admin) and /api/account/password (any signed-in user). */
async function handleUsers(req, res, pathname) {
  const session = requireSession(req);
  if (pathname === '/api/account/password') {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
    requireCsrf(req, session);
    const body = await readJson(req, 16 * 1024);
    await store.changeOwnPassword(session.user.id, body.currentPassword, body.newPassword);
    sessions.destroyUser(session.user.id, { except: hashSessionToken(session.token) });
    sendJson(res, 200, { ok: true });
    return;
  }
  requireAdmin(session);
  const match = pathname.match(/^\/api\/users(?:\/(user_[A-Za-z0-9-]+))?$/);
  const id = match?.[1];
  if (req.method === 'GET' && !id) {
    sendJson(res, 200, { users: store.listUsers(), roles: ['editor', 'publisher', 'admin'] });
    return;
  }
  requireCsrf(req, session);
  const actor = session.user.username;
  if (req.method === 'POST' && !id) {
    const body = await readJson(req, 16 * 1024);
    sendJson(res, 201, { user: await store.createUser({ username: body.username, password: body.password, role: body.role, actor }) });
    return;
  }
  if (req.method === 'PATCH' && id) {
    const body = await readJson(req, 16 * 1024);
    if (id === session.user.id && body.role !== undefined && body.role !== session.user.role) {
      throw new HttpError(409, 'Không thể tự đổi vai trò của chính mình', 'SELF_ROLE_CHANGE');
    }
    const user = await store.updateUser(id, { role: body.role, password: body.password, actor });
    sessions.destroyUser(id);
    sendJson(res, 200, { user });
    return;
  }
  if (req.method === 'DELETE' && id) {
    if (id === session.user.id) throw new HttpError(409, 'Không thể tự xóa tài khoản của chính mình', 'SELF_DELETE');
    const user = await store.deleteUser(id, actor);
    sessions.destroyUser(id);
    sendJson(res, 200, { user });
    return;
  }
  throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
}

function revisionSummary(revision) {
  if (!revision) return null;
  return {
    id: revision.id,
    label: revision.label,
    createdAt: revision.createdAt,
    createdBy: revision.createdBy,
    baseRevisionId: revision.baseRevisionId,
  };
}

function releaseSummary(release) {
  if (!release) return null;
  return {
    id: release.id,
    revisionId: release.revisionId,
    publishedAt: release.publishedAt,
    publishedBy: release.publishedBy,
  };
}

function originFor() {
  return process.env.POC_ORIGIN || `http://${HOST}:${PORT}`;
}

function detectImage(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  const gifHead = buffer.length >= 6 ? buffer.toString('ascii', 0, 6) : '';
  if (gifHead === 'GIF87a' || gifHead === 'GIF89a') {
    return { ext: 'gif', mime: 'image/gif' };
  }
  return null;
}

async function serveFile(res, filePath, { contentType, csp, cache = 'no-cache' } = {}) {
  let data;
  try {
    data = await fs.readFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      throw new HttpError(404, 'File not found', 'NOT_FOUND');
    }
    throw error;
  }
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': contentType || MIME[ext] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': cache,
  };
  if (csp) headers['Content-Security-Policy'] = csp;
  res.writeHead(200, headers);
  res.end(data);
}

async function handleLogin(req, res) {
  const ip = getClientIp(req);
  const limit = loginLimiter.check(ip);
  if (limit.blocked) {
    sendJson(
      res,
      429,
      { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' } },
      { 'Retry-After': String(limit.retryAfterSeconds) },
    );
    return;
  }

  const body = await readJson(req, 64 * 1024);
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password || username.length > 120 || password.length > 500) {
    throw new HttpError(400, 'Username and password are required', 'INVALID_LOGIN');
  }

  const user = store.authenticate(username, password);
  if (!user) {
    loginLimiter.fail(ip);
    await store.appendAudit({ actor: 'anonymous', action: 'login-failed', target: username, details: { ip } });
    throw new HttpError(401, 'Invalid username or password', 'INVALID_LOGIN');
  }

  loginLimiter.reset(ip);
  const created = sessions.create(user);
  await store.appendAudit({ actor: user.username, action: 'login', target: user.id, details: { role: user.role } });
  sendJson(
    res,
    200,
    { user: { username: user.username, role: user.role }, csrf: created.csrf },
    { 'Set-Cookie': serializeSessionCookie(created.token, SESSION_TTL_MS / 1000, HOSTED) },
  );
}

async function handleDraftGet(req, res, session) {
  const draft = await store.getDraftRevision();
  if (!draft) throw new HttpError(404, 'Draft not found', 'NOT_FOUND');
  const published = await store.getPublishedRelease();
  sendJson(res, 200, {
    revision: revisionSummary(draft),
    html: draft.html,
    css: draft.css,
    projectData: draft.projectData,
    publishedRevisionId: published?.revisionId || null,
    publishedRelease: releaseSummary(published),
  });
}

async function handleDraftPut(req, res, session) {
  requireCsrf(req, session);
  const body = await readJson(req, MAX_JSON_BYTES);
  const { html, css, projectData, baseRevisionId } = body;

  if (typeof html !== 'string' || typeof css !== 'string') {
    throw new HttpError(400, 'html and css must be strings', 'INVALID_DRAFT');
  }
  if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) {
    throw new HttpError(400, 'projectData must be an object', 'INVALID_DRAFT');
  }
  if (typeof baseRevisionId !== 'string' || !/^rev_[a-f0-9-]{36}$/.test(baseRevisionId)) {
    throw new HttpError(400, 'baseRevisionId is invalid', 'INVALID_DRAFT');
  }
  if (JSON.stringify(projectData).length > LIMITS.projectData) {
    throw new HttpError(413, 'projectData is too large', 'PAYLOAD_TOO_LARGE');
  }

  const origin = originFor();
  const cleanHtml = sanitizeHtml(html, { origin });
  const cleanCss = sanitizeCss(css, { origin });
  const revision = await store.createRevision({
    html: cleanHtml,
    css: cleanCss,
    projectData,
    createdBy: session.user.username,
    baseRevisionId,
  });

  sendJson(res, 200, {
    revision: revisionSummary(revision),
    html: cleanHtml,
    css: cleanCss,
  });
}


async function handleSiteStateGet(req, res, pageId) {
  const session = requireSession(req);
  const revision = await store.getDraftRevision();
  sendJson(res, 200, {
    revisionId: revision.id,
    label: revision.label,
    document: siteDocumentFor(revision, pageId),
    user: session.user,
  });
}

async function handleSiteStatePut(req, res, session, pageId) {
  requireCsrf(req, session);
  const body = await readJson(req, MAX_JSON_BYTES);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request must be an object', 'INVALID_SITE_DOCUMENT');
  }
  if (typeof body.baseRevisionId !== 'string' || !/^rev_[a-f0-9-]{36}$/.test(body.baseRevisionId)) {
    throw new HttpError(400, 'baseRevisionId is invalid', 'INVALID_DRAFT');
  }
  let document;
  try {
    document = validateSiteDocument(body.document);
  } catch (error) {
    throw new HttpError(400, error.message, 'INVALID_SITE_DOCUMENT');
  }
  if (document.pageId !== pageId) throw new HttpError(400, 'Document route does not match the requested route', 'INVALID_SITE_DOCUMENT');
  if (JSON.stringify(document).length > LIMITS.projectData) {
    throw new HttpError(413, 'Page changes are too large', 'PAYLOAD_TOO_LARGE');
  }
  const current = await store.getDraftRevision();
  const projectData = withPageDocument(current.projectData, document);
  const revision = await store.createRevision({
    html: current.html,
    css: current.css,
    projectData,
    createdBy: session.user.username,
    label: `Page draft: ${pageId}`,
    baseRevisionId: body.baseRevisionId,
  });
  sendJson(res, 200, { revisionId: revision.id, document: siteDocumentFor(revision, pageId) });
}

async function handlePublicSiteState(req, res, pageId) {
  const release = await store.getPublishedRelease();
  sendJson(res, 200, { document: siteDocumentFor({ projectData: release && release.siteDocument }, pageId) });
}

async function handlePreviewSiteState(req, res, token, pageId) {
  const preview = verifyPreviewToken(token, secret);
  if (!preview) throw new HttpError(403, 'Preview link is invalid or expired', 'INVALID_PREVIEW');
  const revision = await store.getRevision(preview.revisionId);
  if (!revision) throw new HttpError(404, 'Preview revision not found', 'NOT_FOUND');
  sendJson(res, 200, { document: siteDocumentFor(revision, pageId) });
}

async function handleVersionsGet(req, res) {
  const [revisions, state, published] = await Promise.all([
    store.listRevisions(),
    Promise.resolve(store.getState()),
    store.getPublishedRelease(),
  ]);
  sendJson(res, 200, {
    versions: revisions.map((revision) => ({
      ...revisionSummary(revision),
      isDraft: revision.id === state.draftRevisionId,
      isPublished: revision.id === published?.revisionId,
      bytes: { html: revision.html.length, css: revision.css.length },
    })),
    state: {
      draftRevisionId: state.draftRevisionId,
      publishedRelease: releaseSummary(published),
    },
  });
}

async function handlePreviewToken(req, res, session, revisionId) {
  requireCsrf(req, session);
  const revision = await store.getRevision(revisionId);
  if (!revision) throw new HttpError(404, 'Revision not found', 'NOT_FOUND');
  const expiresAt = Date.now() + PREVIEW_TTL_MS;
  const token = signPreviewToken({
    revisionId: revision.id,
    userId: session.user.id,
    expiresAt,
  }, secret);
  await store.appendAudit({
    actor: session.user.username,
    action: 'preview-token',
    target: revision.id,
    details: { expiresAt: new Date(expiresAt).toISOString() },
  });
  sendJson(res, 200, {
    url: `/preview?token=${encodeURIComponent(token)}`,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}

async function handleRestore(req, res, session, revisionId) {
  requireCsrf(req, session);
  const revision = await store.getRevision(revisionId);
  if (!revision) throw new HttpError(404, 'Revision not found', 'NOT_FOUND');
  const restored = await store.restoreRevisionAsDraft(revisionId, session.user.username);
  sendJson(res, 200, { revision: revisionSummary(restored) });
}

/** Export content and report deployment errors without logging credential-bearing Git output. */
async function exportRelease(release, actor) {
  if (!EXPORT_ENABLED) return { enabled: false };
  try {
    if (GIT_PUSH_ENABLED) await syncRepository(EXPORT_DIR);
    const exported = await exportStaticSite({
      release,
      outDir: EXPORT_DIR,
      uploadsDir: path.join(DATA_DIR, 'uploads'),
      runtimeFile: path.join(PUBLIC_DIR, 'cms-runtime.js'),
    });
    const result = { enabled: true, dir: EXPORT_DIR, ...exported };
    if (GIT_PUSH_ENABLED) {
      try {
        result.git = await commitAndPush({ repoDir: EXPORT_DIR, files: exported.files, message: `cms: publish ${release.revisionId} by ${actor}` });
      } catch (error) {
        console.error('CMS Git publish failed; check repository access or conflicts.');
        result.gitError = 'Git commit or push failed; the files were written but not published.';
      }
    }
    return result;
  } catch (error) {
    console.error('CMS export failed; check storage and repository state.');
    return { enabled: true, error: 'The release was saved but writing the static site files failed.' };
  }
}

async function handlePublish(req, res, session, revisionId) {
  requireCsrf(req, session);
  requirePublisher(session);
  const revision = await store.getRevision(revisionId);
  if (!revision) throw new HttpError(404, 'Revision not found', 'NOT_FOUND');
  await enqueuePublish(async () => {
    const candidate = { revisionId, publishedAt: new Date().toISOString(),
      publishedBy: session.user.username, siteDocument: revision.projectData };
    const exported = await exportRelease(candidate, session.user.username);
    if (exported.error || exported.gitError) {
      throw new HttpError(502, exported.error || exported.gitError, 'PUBLISH_FAILED');
    }
    const release = await store.publishRevision(revisionId, session.user.username);
    sendJson(res, 200, { release: releaseSummary(release), revision: revisionSummary(revision), export: exported });
  });
}

async function handleUpload(req, res, session) {
  requireCsrf(req, session);
  const type = String(req.headers['content-type'] || '');
  if (!type.toLowerCase().startsWith('multipart/form-data')) {
    throw new HttpError(415, 'Expected multipart/form-data', 'UNSUPPORTED_MEDIA_TYPE');
  }
  const body = await readBody(req, MAX_UPLOAD_BYTES + 128 * 1024);
  let form;
  try {
    form = await new Response(body, { headers: { 'content-type': type } }).formData();
  } catch {
    throw new HttpError(400, 'Invalid multipart form data', 'INVALID_UPLOAD');
  }
  const file = form.get('files') || form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    throw new HttpError(400, 'No file field found', 'INVALID_UPLOAD');
  }
  if (!file.size) throw new HttpError(400, 'File is empty', 'INVALID_UPLOAD');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, 'Image exceeds the 2 MB upload limit', 'PAYLOAD_TOO_LARGE');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImage(buffer);
  if (!detected) {
    throw new HttpError(415, 'Only PNG, JPEG, WebP or GIF images are allowed', 'UNSUPPORTED_MEDIA_TYPE');
  }
  const asset = await store.addAsset({
    buffer,
    mime: detected.mime,
    ext: detected.ext,
    originalName: file.name,
    actor: session.user.username,
  });
  sendJson(res, 200, { data: [asset] });
}

async function serveMedia(req, res, filename) {
  if (!/^[a-f0-9-]{36}\.(?:png|jpg|jpeg|webp|gif)$/.test(filename)) {
    throw new HttpError(404, 'Media not found', 'NOT_FOUND');
  }
  const info = await store.getAssetFile(filename);
  if (!info) throw new HttpError(404, 'Media not found', 'NOT_FOUND');

  const published = await store.isAssetPublished(filename) || await contentStore.isAssetPublished(filename);
  const session = getSession(req);
  const cookies = parseCookies(req.headers.cookie || '');
  const preview = cookies.poc_preview ? verifyPreviewToken(cookies.poc_preview, secret) : null;
  let previewAllows = false;
  if (!published && !session && preview) {
    const revision = await store.getRevision(preview.revisionId);
    previewAllows = Boolean(revision && revision.html.includes(`/media/${filename}`));
  }
  if (!published && !session && !previewAllows) {
    throw new HttpError(404, 'Media not found', 'NOT_FOUND');
  }

  const data = await fs.readFile(info.filePath);
  res.writeHead(200, {
    'Content-Type': info.asset.type,
    'Content-Length': data.length,
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `inline; filename="${info.asset.file}"`,
    'Content-Security-Policy': MEDIA_CSP,
  });
  res.end(data);
}

function pageIdFromUrl(url) {
  try {
    return normalizePageIdFromUrl(url);
  } catch {
    throw new HttpError(400, 'Page route is invalid', 'INVALID_ROUTE');
  }
}

async function handleRoutesGet(req, res) {
  requireSession(req);
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(STATIC_SITE_DIR, 'manifest.json'), 'utf8'));
    const routes = manifestRoutes(manifest);
    sendJson(res, 200, { routes });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Unable to read the local route manifest', 'ROUTES_UNAVAILABLE');
  }
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = url.pathname;

  setBaselineHeaders(res);
  if (HOSTED && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.headers.origin !== originFor()) {
    throw new HttpError(403, 'Request origin is not allowed', 'ORIGIN_REJECTED');
  }

  if (pathname.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }

  if (await contentRoutes(req, res, url)) return;

  if (pathname === '/healthz' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    await handleLogin(req, res);
    return;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const session = requireSession(req);
    requireCsrf(req, session);
    sessions.destroy(session.token);
    await store.appendAudit({ actor: session.user.username, action: 'logout', target: session.user.id });
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': `${clearSessionCookie()}${HOSTED ? '; Secure' : ''}` });
    return;
  }

  if (pathname === '/api/account/password' || /^\/api\/users(?:\/|$)/.test(pathname)) {
    await handleUsers(req, res, pathname);
    return;
  }

  if (pathname === '/api/session' && req.method === 'GET') {
    const session = requireSession(req);
    const state = store.getState();
    const published = await store.getPublishedRelease();
    sendJson(res, 200, {
      user: session.user,
      csrf: session.csrf,
      state: {
        draftRevisionId: state.draftRevisionId,
        publishedRelease: releaseSummary(published),
      },
    });
    return;
  }

  if (pathname === '/api/draft' && req.method === 'GET') {
    const session = requireSession(req);
    await handleDraftGet(req, res, session);
    return;
  }

  if (pathname === '/api/draft' && req.method === 'PUT') {
    const session = requireSession(req);
    await handleDraftPut(req, res, session);
    return;
  }

  if (pathname === '/api/site-state' && req.method === 'GET') {
    await handleSiteStateGet(req, res, pageIdFromUrl(url));
    return;
  }

  if (pathname === '/api/site-state' && req.method === 'PUT') {
    const session = requireSession(req);
    await handleSiteStatePut(req, res, session, pageIdFromUrl(url));
    return;
  }

  if (pathname === '/api/site-state/public' && req.method === 'GET') {
    await handlePublicSiteState(req, res, pageIdFromUrl(url));
    return;
  }

  if (pathname === '/api/site-state/preview' && req.method === 'GET') {
    await handlePreviewSiteState(req, res, url.searchParams.get('token') || '', pageIdFromUrl(url));
    return;
  }

  if (pathname === '/api/versions' && req.method === 'GET') {
    requireSession(req);
    await handleVersionsGet(req, res);
    return;
  }

  if (pathname === '/api/routes' && req.method === 'GET') {
    await handleRoutesGet(req, res);
    return;
  }

  if (pathname === '/api/assets' && req.method === 'GET') {
    requireSession(req);
    sendJson(res, 200, { data: store.listAssets() });
    return;
  }

  if (pathname === '/api/uploads' && req.method === 'POST') {
    const session = requireSession(req);
    await handleUpload(req, res, session);
    return;
  }

  const versionRoute = pathname.match(/^\/api\/versions\/(rev_[a-f0-9-]{36})\/(preview-token|restore|publish)$/);
  if (versionRoute) {
    const [, revisionId, action] = versionRoute;
    const session = requireSession(req);
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
    }
    if (action === 'preview-token') {
      await handlePreviewToken(req, res, session, revisionId);
      return;
    }
    if (action === 'restore') {
      await handleRestore(req, res, session, revisionId);
      return;
    }
    if (action === 'publish') {
      await handlePublish(req, res, session, revisionId);
      return;
    }
  }

  if (pathname.startsWith('/api/')) {
    throw new HttpError(404, 'API route not found', 'NOT_FOUND');
  }

  if (pathname === '/' || pathname === '/index.html') {
    await archiveProxy(req, res);
    return;
  }

  if (pathname === '/preview' && req.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    const preview = verifyPreviewToken(token, secret);
    if (!preview || !(await store.getRevision(preview.revisionId))) {
      setCsp(res, PUBLIC_CSP);
      sendHtml(res, 403, renderErrorPage({
        title: 'Preview link is invalid or expired',
        message: 'Ask the editor for a fresh preview link. Preview links expire after 15 minutes.',
      }));
      return;
    }
    await archiveProxy(req, res, { previewToken: token });
    return;
  }

  if (/^\/(?:deedee-studio-static\/)?media\//.test(pathname) && req.method === 'GET') {
    const filename = decodeURIComponent(pathname.replace(/^\/(?:deedee-studio-static\/)?media\//, ''));
    await serveMedia(req, res, filename);
    return;
  }

  if (pathname === '/cms-runtime.js' && req.method === 'GET') {
    await serveFile(res, path.join(PUBLIC_DIR, 'cms-runtime.js'), {
      contentType: MIME['.js'],
      cache: 'no-store',
    });
    return;
  }

  if (pathname === '/demo-art.svg' && req.method === 'GET') {
    await serveFile(res, path.join(SHARED_DIR, 'demo-art.svg'), {
      contentType: 'image/svg+xml',
      csp: MEDIA_CSP,
    });
    return;
  }

  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/index.html') {
    const session = getSession(req);
    if (!session) {
      redirect(res, '/admin/login', 302);
      return;
    }
    setCsp(res, ADMIN_CSP);
    await serveFile(res, path.join(PUBLIC_DIR, 'admin', 'site-editor.html'), {
      contentType: MIME['.html'],
      csp: ADMIN_CSP,
      cache: 'no-store',
    });
    return;
  }

  if (pathname === '/admin/users' || pathname === '/admin/users/') {
    if (!getSession(req)) {
      redirect(res, '/admin/login', 302);
      return;
    }
    setCsp(res, ADMIN_CSP);
    await serveFile(res, path.join(PUBLIC_DIR, 'admin', 'users.html'), {
      contentType: MIME['.html'],
      csp: ADMIN_CSP,
      cache: 'no-store',
    });
    return;
  }

  if (pathname === '/admin/login' || pathname === '/admin/login/' || pathname === '/admin/login.html') {
    if (getSession(req)) {
      redirect(res, '/admin', 302);
      return;
    }
    setCsp(res, ADMIN_CSP);
    await serveFile(res, path.join(PUBLIC_DIR, 'admin', 'login.html'), {
      contentType: MIME['.html'],
      csp: ADMIN_CSP,
      cache: 'no-store',
    });
    return;
  }

  if (pathname.startsWith('/admin/') && req.method === 'GET') {
    const relative = decodeURIComponent(pathname.slice('/admin/'.length));
    const root = path.join(PUBLIC_DIR, 'admin');
    const candidate = path.resolve(root, relative);
    if (!candidate.startsWith(`${root}${path.sep}`)) {
      throw new HttpError(404, 'Not found', 'NOT_FOUND');
    }
    setCsp(res, ADMIN_CSP);
    await serveFile(res, candidate, { csp: ADMIN_CSP });
    return;
  }

  if (pathname === '/vendor/grapes.min.js' && req.method === 'GET') {
    setCsp(res, ADMIN_CSP);
    await serveFile(res, path.join(GRAPES_DIST, 'grapes.min.js'), {
      contentType: MIME['.js'],
      csp: ADMIN_CSP,
    });
    return;
  }

  if (pathname === '/vendor/grapes.min.css' && req.method === 'GET') {
    setCsp(res, ADMIN_CSP);
    await serveFile(res, path.join(GRAPES_DIST, 'css', 'grapes.min.css'), {
      contentType: MIME['.css'],
      csp: ADMIN_CSP,
    });
    return;
  }

  await archiveProxy(req, res);
  return;
}

const server = http.createServer((req, res) => {
  route(req, res).catch(async (error) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }

    const isApi = req.url?.startsWith('/api/');

    if (error instanceof StoreConflictError) {
      if (isApi) {
        sendJson(res, 409, {
          error: { code: 'CONFLICT', message: error.message },
          currentRevision: revisionSummary(error.currentRevision),
        });
      } else {
        sendHtml(res, 409, renderErrorPage({ title: 'Draft changed', message: error.message }));
      }
      return;
    }

    if (error instanceof UserError) {
      sendJson(res, error.status, { error: { code: error.code, message: error.message } });
      return;
    }

    if (error instanceof ContentPolicyError) {
      if (isApi) {
        sendJson(res, 400, { error: { code: error.code, message: error.message } });
      } else {
        sendHtml(res, 400, renderErrorPage({ title: 'Content rejected', message: error.message }));
      }
      return;
    }

    if (error instanceof HttpError) {
      if (isApi) {
        sendJson(res, error.status, {
          error: { code: error.code, message: error.message },
          ...(error.details ? { details: error.details } : {}),
        }, error.status === 429 ? { 'Retry-After': res.getHeader('Retry-After') || '60' } : {});
      } else {
        setCsp(res, PUBLIC_CSP);
        sendHtml(res, error.status, renderErrorPage({ title: 'Request failed', message: error.message }));
      }
      return;
    }

    console.error('[poc] unhandled error:', error);
    if (isApi) {
      sendJson(res, 500, { error: { code: 'INTERNAL', message: 'Internal server error' } });
    } else {
      sendHtml(res, 500, renderErrorPage({ title: 'Server error', message: 'The local CMS service hit an unexpected error.' }));
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`DeeDee Studio CMS: http://${HOST}:${PORT}`);
  console.log(`Admin: http://${HOST}:${PORT}/admin`);
  if (HOSTED) console.log('Accounts: managed in /admin/users by an admin.');
  else console.log('Demo accounts (change them in /admin/users): admin / admin-demo, publisher / publisher-demo, editor / editor-demo');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2_000).unref();
  });
}
