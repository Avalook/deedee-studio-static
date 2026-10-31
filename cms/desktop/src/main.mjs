import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, session, shell } from 'electron';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnvironment, isActivationCode } from './git-env.mjs';
import { ONE_USER_CSS } from './one-user.mjs';
import { createSecrets, newSecrets } from './secrets.mjs';
import { runSmokeTest } from './smoke.mjs';

const SITE = 'https://avalook.github.io/deedee-studio-static/';
const EXIT_NO_ACCESS = 3;
const here = path.dirname(fileURLToPath(import.meta.url));
const smoke = process.env.DEEDEE_SMOKE_REMOTE ? { remote: process.env.DEEDEE_SMOKE_REMOTE, result: process.env.DEEDEE_SMOKE_RESULT } : null;
if (process.env.DEEDEE_USER_DATA) app.setPath('userData', process.env.DEEDEE_USER_DATA);

const resources = app.isPackaged ? process.resourcesPath : path.join(here, '..');
const cmsDir = app.isPackaged ? path.join(resources, 'cms') : path.join(resources, 'build', 'cms');
const gitDir = app.isPackaged ? path.join(resources, 'git') : path.join(resources, 'node_modules', 'dugite', 'git');
const userData = app.getPath('userData');
const secrets = createSecrets({ dir: userData, cipher: smoke ? { encryptString: Buffer.from, decryptString: String } : safeStorage });

let window;
let server;
let origin;
let values;
let leaving = false;

const status = (message, extra = {}) => window?.webContents.send('status', { message, ...extra });

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}

async function startServer() {
  const port = await freePort();
  await mkdir(path.join(userData, 'logs'), { recursive: true });
  const log = createWriteStream(path.join(userData, 'logs', 'cms.log'), { flags: 'a' });
  const env = {
    ...gitEnvironment(process.env, { gitDir, token: values.token }), ELECTRON_RUN_AS_NODE: '1',
    POC_PORT: String(port), POC_DATA_DIR: path.join(userData, 'data'), CMS_EXPORT_DIR: path.join(userData, 'website'),
    POC_ADMIN_PASSWORD: values.adminPassword, POC_PUBLISHER_PASSWORD: values.publisherPassword, POC_EDITOR_PASSWORD: values.editorPassword,
    ...(values.formKey ? { SUPABASE_SERVICE_ROLE_KEY: values.formKey } : {}), ...(smoke ? { DEEDEE_TEST_REMOTE: smoke.remote } : {}),
  };
  server = spawn(process.execPath, [path.join(cmsDir, 'start-desktop.mjs')], { cwd: cmsDir, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  origin = `http://127.0.0.1:${port}`;
  return new Promise((resolve) => {
    const exited = new Promise((done) => server.once('exit', (code) => done({ exited: true, code })));
    const ready = (async () => {
      while (server) {
        const up = await fetch(`${origin}/healthz`).then((response) => response.ok, () => false);
        if (up) return { exited: false };
        await new Promise((done) => setTimeout(done, 500));
      }
      return { exited: true, code: 1 };
    })();
    Promise.race([exited, ready]).then(resolve);
  });
}

async function signIn() {
  const response = await session.defaultSession.fetch(`${origin}/api/login`, { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ username: 'admin', password: values.adminPassword }) });
  if (!response.ok) throw new Error(`Sign-in failed (${response.status})`);
  return response.json();
}

function openEditor() {
  const contents = window.webContents;
  const local = (url) => url.startsWith(`${origin}/`) || url === origin;
  contents.setWindowOpenHandler(({ url }) => {
    if (local(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (local(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });
  contents.on('dom-ready', () => contents.insertCSS(ONE_USER_CSS));
  // Sessions last 8 hours and signing out has no meaning here: go straight back in.
  contents.on('did-navigate', async (_event, url) => {
    if (!new URL(url).pathname.startsWith('/admin/login')) return;
    await signIn();
    window.loadURL(`${origin}/admin`);
  });
  return window.loadURL(`${origin}/admin`);
}

// GitHub answers a wrong or expired code with 401 even for public data, so the checkout fails before the write check.
const codeRejected = (token) => fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}` } })
  .then((response) => response.status === 401, () => false);

async function launch() {
  status('Đang cập nhật dữ liệu website. Lần đầu có thể mất vài phút…');
  const started = await startServer();
  if (started.exited) {
    server = null;
    if (smoke) app.exit(1);
    if (started.code === EXIT_NO_ACCESS || await codeRejected(values.token)) {
      await secrets.clear();
      values = null;
      status('Kích hoạt DeeDee CMS', { needsCode: true, error: 'Mã này sai, đã hết hạn hoặc không có quyền xuất bản lên website.' });
      return;
    }
    status('Chưa mở được CMS', { error: 'Hãy kiểm tra kết nối Internet rồi mở lại ứng dụng.' });
    return;
  }
  const login = await signIn();
  if (smoke) {
    await runSmokeTest({ fetch: session.defaultSession.fetch.bind(session.defaultSession), origin, csrf: login.csrf, resultFile: smoke.result });
    app.quit();
    return;
  }
  await openEditor();
}

async function activate({ code, formKey }) {
  const token = String(code ?? '').trim();
  if (!isActivationCode(token)) {
    status('Kích hoạt DeeDee CMS', { needsCode: true, error: 'Mã kích hoạt không đúng định dạng.' });
    return;
  }
  await rm(path.join(userData, 'data', 'users.json'), { force: true });
  values = await secrets.write(newSecrets({ token, formKey: String(formKey ?? '').trim() }));
  await launch();
}

function buildMenu() {
  const reactivate = async () => {
    const { response } = await dialog.showMessageBox(window, { type: 'question', buttons: ['Đổi mã', 'Huỷ'], cancelId: 1, defaultId: 1,
      message: 'Đổi mã kích hoạt?', detail: 'Ứng dụng sẽ khởi động lại và yêu cầu mã mới. Bản nháp vẫn được giữ.' });
    if (response) return;
    await secrets.write({ ...values, token: '' });
    app.relaunch();
    app.quit();
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'DeeDee CMS', submenu: [
      { label: 'Mở website công khai', click: () => shell.openExternal(SITE) },
      { label: 'Đổi mã kích hoạt…', click: reactivate },
      { type: 'separator' },
      { label: 'Thoát', role: 'quit' },
    ] },
    { role: 'editMenu', label: 'Sửa' },
    { label: 'Xem', submenu: [{ label: 'Tải lại', role: 'reload' }, { type: 'separator' }, { label: 'Cỡ thật', role: 'resetZoom' }, { label: 'Phóng to', role: 'zoomIn' }, { label: 'Thu nhỏ', role: 'zoomOut' }] },
  ]));
}

function stopServer() {
  const running = server;
  server = null;
  running?.kill();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.focus(); });
  app.on('before-quit', () => { leaving = true; stopServer(); });
  app.on('window-all-closed', () => app.quit());
  ipcMain.handle('activate', (_event, input) => activate(input));

  app.whenReady().then(async () => {
    buildMenu();
    window = new BrowserWindow({ width: 1440, height: 900, minWidth: 1024, minHeight: 640, title: 'DeeDee CMS', show: !smoke,
      webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, sandbox: true } });
    await window.loadFile(path.join(here, 'ui', 'start.html'));
    values = await secrets.read() ?? (smoke ? await secrets.write(newSecrets({ token: 'smoke-test' })) : null);
    if (values?.token) await launch();
    else status('Kích hoạt DeeDee CMS', { needsCode: true });
  }).catch(async (error) => {
    if (leaving) return;
    if (smoke) app.exit(1);
    await dialog.showMessageBox({ type: 'error', message: 'DeeDee CMS gặp lỗi', detail: error.message });
    app.exit(1);
  });
}
