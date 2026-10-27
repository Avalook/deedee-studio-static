import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from './auth.mjs';
import { createEmptySiteDocument } from './site-document.mjs';

const REVISION_ID = /^rev_[a-f0-9-]{36}$/;
const RELEASE_ID = /^rel_[a-f0-9-]{36}$/;
const ASSET_FILE = /^[a-f0-9-]{36}\.(?:png|jpg|jpeg|webp|gif|mp4|webm)$/;

const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

class StoreConflictError extends Error {
  constructor(currentRevision) {
    super('Revision conflict: the draft changed since it was loaded');
    this.name = 'StoreConflictError';
    this.code = 'CONFLICT';
    this.currentRevision = currentRevision;
  }
}

export const ROLES = ['editor', 'publisher', 'admin'];
const DEMO_PASSWORDS = new Set(['editor-demo', 'publisher-demo', 'admin-demo']);

export class UserError extends Error {
  constructor(message, code = 'USER_INVALID', status = 400) {
    super(message);
    this.name = 'UserError';
    this.code = code;
    this.status = status;
  }
}

function validateUsername(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(name)) throw new UserError('Tên đăng nhập gồm 3–40 ký tự chữ, số, . _ -');
  return name;
}

function validateRole(role) {
  if (!ROLES.includes(role)) throw new UserError('Vai trò không hợp lệ (editor, publisher hoặc admin)');
}

function validatePassword(password, username = '') {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) throw new UserError('Mật khẩu cần từ 12 ký tự');
  if (DEMO_PASSWORDS.has(password) || password.toLowerCase().includes(String(username).toLowerCase()) && username.length >= 3) {
    throw new UserError('Mật khẩu quá dễ đoán; không dùng mật khẩu mẫu hoặc tên đăng nhập');
  }
}

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

function isoNow() {
  return new Date().toISOString();
}

function safeAssetName(name) {
  const cleaned = String(name || 'upload')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 120);
  return cleaned || 'upload';
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temp, file);
  } catch (error) {
    await fs.unlink(temp).catch(() => {});
    throw error;
  }
}

export async function createStore({ dataDir, seedDir, demoUsers }) {
  const revisionsDir = path.join(dataDir, 'revisions');
  const releasesDir = path.join(dataDir, 'releases');
  const uploadsDir = path.join(dataDir, 'uploads');
  const stateFile = path.join(dataDir, 'state.json');
  const usersFile = path.join(dataDir, 'users.json');
  const assetsFile = path.join(dataDir, 'assets.json');
  const auditFile = path.join(dataDir, 'audit.log');

  for (const dir of [dataDir, revisionsDir, releasesDir, uploadsDir]) {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  }

  let state = await readJson(stateFile, null);
  let assets = await readJson(assetsFile, []);
  let lock = Promise.resolve();

  function adminCount() {
    return users.users.filter((user) => user.role === 'admin').length;
  }

  function withLock(fn) {
    const run = lock.then(fn, fn);
    lock = run.catch(() => {});
    return run;
  }

  function revisionPath(id) {
    if (!REVISION_ID.test(id)) throw new Error('Invalid revision id');
    return path.join(revisionsDir, `${id}.json`);
  }

  function releasePath(id) {
    if (!RELEASE_ID.test(id)) throw new Error('Invalid release id');
    return path.join(releasesDir, `${id}.json`);
  }

  async function getRevision(id) {
    return readJson(revisionPath(id), null);
  }

  async function getRelease(id) {
    return readJson(releasePath(id), null);
  }

  async function appendAudit({ actor = 'system', action, target = '', details = {} }) {
    const record = {
      ts: isoNow(),
      actor,
      action,
      target,
      details,
    };
    await fs.appendFile(auditFile, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    return record;
  }

  async function writeRevision(revision) {
    await writeJsonAtomic(revisionPath(revision.id), revision);
  }

  if (!state) {
    const seedHtml = await fs.readFile(path.join(seedDir, 'demo.html'), 'utf8');
    const seedCss = await fs.readFile(path.join(seedDir, 'demo.css'), 'utf8');
    const now = isoNow();
    const seedRevision = {
      id: `rev_${randomUUID()}`,
      label: 'Seed demo page',
      createdAt: now,
      createdBy: 'system',
      baseRevisionId: null,
      html: seedHtml,
      css: seedCss,
      projectData: createEmptySiteDocument(),
    };
    const seedRelease = {
      id: `rel_${randomUUID()}`,
      revisionId: seedRevision.id,
      publishedAt: now,
      publishedBy: 'system',
      html: seedHtml,
      css: seedCss,
      siteDocument: createEmptySiteDocument(),
    };
    await writeRevision(seedRevision);
    await writeJsonAtomic(releasePath(seedRelease.id), seedRelease);
    state = {
      draftRevisionId: seedRevision.id,
      publishedReleaseId: seedRelease.id,
      seededAt: now,
    };
    await writeJsonAtomic(stateFile, state);
    await appendAudit({
      action: 'seed',
      target: seedRevision.id,
      details: { releaseId: seedRelease.id },
    });
  }

  const draftAtBoot = await getRevision(state.draftRevisionId);
  const releaseAtBoot = await getRelease(state.publishedReleaseId);
  if (!draftAtBoot || !releaseAtBoot) {
    throw new Error('Store state points to missing revision or release files');
  }

  let users = await readJson(usersFile, null);
  if (!users) {
    users = {
      users: demoUsers.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        passwordHash: hashPassword(user.password),
        createdAt: isoNow(),
      })),
    };
    await writeJsonAtomic(usersFile, users);
    await appendAudit({ action: 'seed-users', target: 'users', details: { usernames: users.users.map((u) => u.username) } });
  }

  // Accounts need an owner. Older data directories only have editor + publisher, so make sure an admin exists:
  // a dedicated one when POC_ADMIN_PASSWORD is set (or in local demo mode), otherwise promote the publisher.
  if (!users.users.some((user) => user.role === 'admin')) {
    const password = process.env.POC_ADMIN_PASSWORD || (process.env.POC_HOSTED === '1' ? '' : 'admin-demo');
    const publisher = users.users.find((user) => user.role === 'publisher');
    if (password && !users.users.some((user) => user.username === 'admin')) {
      users.users.push({ id: `user_${randomUUID()}`, username: 'admin', role: 'admin', passwordHash: hashPassword(password), createdAt: isoNow() });
    } else if (publisher) {
      publisher.role = 'admin';
    }
    await writeJsonAtomic(usersFile, users);
    await appendAudit({ action: 'seed-admin', target: 'users' });
  }

  if (!Array.isArray(assets)) {
    throw new Error('assets.json must contain an array');
  }
  try {
    await fs.access(assetsFile);
  } catch {
    await writeJsonAtomic(assetsFile, assets);
  }

  const store = {
    getState() {
      return { ...state };
    },

    getRevision,
    getRelease,

    async getDraftRevision() {
      return getRevision(state.draftRevisionId);
    },

    async getPublishedRelease() {
      return getRelease(state.publishedReleaseId);
    },

    async listRevisions() {
      const files = await fs.readdir(revisionsDir);
      const revisions = await Promise.all(
        files
          .filter((file) => file.endsWith('.json'))
          .map(async (file) => {
            try {
              return JSON.parse(await fs.readFile(path.join(revisionsDir, file), 'utf8'));
            } catch {
              return null;
            }
          }),
      );
      return revisions
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },

    createRevision({ html, css, projectData, createdBy, label = '', baseRevisionId }) {
      return withLock(async () => {
        if (baseRevisionId !== state.draftRevisionId) {
          throw new StoreConflictError(await getRevision(state.draftRevisionId));
        }
        const revision = {
          id: `rev_${randomUUID()}`,
          label: String(label || `Draft ${isoNow()}`).slice(0, 160),
          createdAt: isoNow(),
          createdBy,
          baseRevisionId,
          html,
          css,
          projectData,
        };
        await writeRevision(revision);
        state = { ...state, draftRevisionId: revision.id };
        await writeJsonAtomic(stateFile, state);
        await appendAudit({
          actor: createdBy,
          action: 'save-draft',
          target: revision.id,
          details: { baseRevisionId, htmlBytes: html.length, cssBytes: css.length },
        });
        return revision;
      });
    },

    publishRevision(id, actor) {
      return withLock(async () => {
        const revision = await getRevision(id);
        if (!revision) throw new Error('Revision not found');
        const release = {
          id: `rel_${randomUUID()}`,
          revisionId: revision.id,
          publishedAt: isoNow(),
          publishedBy: actor,
          html: revision.html,
          css: revision.css,
          siteDocument: revision.projectData,
        };
        await writeJsonAtomic(releasePath(release.id), release);
        state = { ...state, publishedReleaseId: release.id };
        await writeJsonAtomic(stateFile, state);
        await appendAudit({
          actor,
          action: 'publish',
          target: release.id,
          details: { revisionId: revision.id },
        });
        return release;
      });
    },

    restoreRevisionAsDraft(id, actor) {
      return withLock(async () => {
        const source = await getRevision(id);
        if (!source) throw new Error('Revision not found');
        const revision = {
          id: `rev_${randomUUID()}`,
          label: `Restored from ${source.label}`.slice(0, 160),
          createdAt: isoNow(),
          createdBy: actor,
          baseRevisionId: state.draftRevisionId,
          html: source.html,
          css: source.css,
          projectData: source.projectData,
        };
        await writeRevision(revision);
        state = { ...state, draftRevisionId: revision.id };
        await writeJsonAtomic(stateFile, state);
        await appendAudit({
          actor,
          action: 'restore-draft',
          target: revision.id,
          details: { sourceRevisionId: source.id },
        });
        return revision;
      });
    },

    listUsers() {
      return users.users.map(publicUser).sort((a, b) => a.username.localeCompare(b.username));
    },

    createUser({ username, password, role, actor = 'system' }) {
      return withLock(async () => {
        const name = validateUsername(username);
        validateRole(role);
        validatePassword(password, name);
        if (users.users.some((user) => user.username.toLowerCase() === name.toLowerCase())) throw new UserError('Tên đăng nhập đã tồn tại', 'USER_EXISTS', 409);
        const user = { id: `user_${randomUUID()}`, username: name, role, passwordHash: hashPassword(password), createdAt: isoNow() };
        users = { users: [...users.users, user] };
        await writeJsonAtomic(usersFile, users);
        await appendAudit({ actor, action: 'user-create', target: user.id, details: { username: name, role } });
        return publicUser(user);
      });
    },

    updateUser(id, { role, password, actor = 'system' }) {
      return withLock(async () => {
        const user = users.users.find((entry) => entry.id === id);
        if (!user) throw new UserError('Không tìm thấy tài khoản', 'USER_NOT_FOUND', 404);
        const next = { ...user };
        if (role !== undefined) {
          validateRole(role);
          if (user.role === 'admin' && role !== 'admin' && adminCount() <= 1) throw new UserError('Phải còn ít nhất một admin', 'LAST_ADMIN', 409);
          next.role = role;
        }
        if (password !== undefined) {
          validatePassword(password, user.username);
          next.passwordHash = hashPassword(password);
        }
        users = { users: users.users.map((entry) => (entry.id === id ? next : entry)) };
        await writeJsonAtomic(usersFile, users);
        await appendAudit({ actor, action: 'user-update', target: id, details: { role: role ?? undefined, passwordChanged: password !== undefined } });
        return publicUser(next);
      });
    },

    deleteUser(id, actor = 'system') {
      return withLock(async () => {
        const user = users.users.find((entry) => entry.id === id);
        if (!user) throw new UserError('Không tìm thấy tài khoản', 'USER_NOT_FOUND', 404);
        if (user.role === 'admin' && adminCount() <= 1) throw new UserError('Phải còn ít nhất một admin', 'LAST_ADMIN', 409);
        users = { users: users.users.filter((entry) => entry.id !== id) };
        await writeJsonAtomic(usersFile, users);
        await appendAudit({ actor, action: 'user-delete', target: id, details: { username: user.username } });
        return publicUser(user);
      });
    },

    changeOwnPassword(id, currentPassword, newPassword) {
      return withLock(async () => {
        const user = users.users.find((entry) => entry.id === id);
        if (!user || !verifyPassword(currentPassword, user.passwordHash)) throw new UserError('Mật khẩu hiện tại không đúng', 'WRONG_PASSWORD', 403);
        validatePassword(newPassword, user.username);
        users = { users: users.users.map((entry) => (entry.id === id ? { ...entry, passwordHash: hashPassword(newPassword) } : entry)) };
        await writeJsonAtomic(usersFile, users);
        await appendAudit({ actor: user.username, action: 'password-change', target: id });
        return publicUser(user);
      });
    },

    authenticate(username, password) {
      const user = users.users.find((entry) => entry.username === username);
      const valid = verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
      if (!user || !valid) return null;
      return { id: user.id, username: user.username, role: user.role };
    },

    listAssets() {
      return assets
        .slice()
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((asset) => ({ ...asset, src: `/media/${asset.file}` }));
    },

    addAsset({ buffer, mime, ext, originalName, actor = 'system' }) {
      return withLock(async () => {
        const id = randomUUID();
        const file = `${id}.${ext}`;
        if (!ASSET_FILE.test(file)) throw new Error('Invalid asset filename');
        const asset = {
          id,
          file,
          name: safeAssetName(originalName),
          type: mime,
          size: buffer.length,
          createdAt: isoNow(),
        };
        await fs.writeFile(path.join(uploadsDir, file), buffer, { mode: 0o600, flag: 'wx' });
        assets = [asset, ...assets];
        await writeJsonAtomic(assetsFile, assets);
        await appendAudit({
          actor,
          action: 'upload',
          target: file,
          details: { bytes: buffer.length, type: mime },
        });
        return { ...asset, src: `/media/${file}` };
      });
    },

    async getAssetFile(filename) {
      if (!ASSET_FILE.test(filename)) return null;
      const asset = assets.find((entry) => entry.file === filename);
      if (!asset) return null;
      const filePath = path.join(uploadsDir, filename);
      try {
        const stat = await fs.stat(filePath);
        return { asset, filePath, stat };
      } catch {
        return null;
      }
    },

    async isAssetPublished(filename) {
      if (!ASSET_FILE.test(filename)) return false;
      const release = await getRelease(state.publishedReleaseId);
      return Boolean(
        release &&
          (release.html.includes(`/media/${filename}`) ||
            JSON.stringify(release.siteDocument || {}).includes(`/media/${filename}`)),
      );
    },

    appendAudit,
  };

  return store;
}

export { StoreConflictError };
