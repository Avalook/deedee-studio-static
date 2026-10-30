import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Release check: the packaged app must clone, start, sign in, and publish an edit to a throwaway copy of the repository.
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = path.resolve(desktop, '..', '..');
const output = path.join(desktop, 'release');

async function packagedApp() {
  if (process.platform === 'win32') return path.join(output, 'win-unpacked', 'DeeDee CMS.exe');
  const folder = (await readdir(output)).find((name) => /^mac(-|$)/.test(name));
  return path.join(output, folder, 'DeeDee CMS.app', 'Contents', 'MacOS', 'DeeDee CMS');
}

const root = await mkdtemp(path.join(os.tmpdir(), 'deedee-smoke-'));
const remote = path.join(root, 'remote.git');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, stdio: 'pipe' });
git(['init', '--bare', '--initial-branch=main', remote]);
git(['config', 'receive.shallowUpdate', 'true'], remote);
git(['push', remote, 'HEAD:refs/heads/main'], repository);
git(['config', 'uploadpack.allowFilter', 'true'], remote);
const result = path.join(root, 'result.json');
const env = { ...process.env, DEEDEE_SMOKE_REMOTE: pathToFileURL(remote).href, DEEDEE_SMOKE_RESULT: result, DEEDEE_USER_DATA: path.join(root, 'data') };

const app = spawn(await packagedApp(), { env, stdio: 'inherit' });
const timer = setTimeout(() => app.kill(), 5 * 60 * 1000);
const code = await new Promise((resolve) => app.once('exit', resolve));
clearTimeout(timer);
const report = await readFile(result, 'utf8').then(JSON.parse, () => null);
console.log('exit', code, report);
const log = await readFile(path.join(root, 'data', 'logs', 'cms.log'), 'utf8').catch(() => '');
console.log(log);
await rm(root, { recursive: true, force: true }).catch(() => {});
if (code !== 0 || report?.published !== 200 || report?.editor !== 200 || !report?.git?.pushed) process.exit(1);
