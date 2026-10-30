import { cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The app ships the CMS server with its production dependencies only.
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(desktop, '..', 'grapesjs');
const target = path.join(desktop, 'build', 'cms');

await rm(target, { recursive: true, force: true });
for (const name of ['lib', 'public', 'seed', 'server.mjs', 'start-desktop.mjs', 'package.json', 'package-lock.json']) {
  await cp(path.join(source, name), path.join(target, name), { recursive: true });
}
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--omit=dev', '--ignore-scripts'],
  { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' });
// These command shortcuts are absolute links into the build folder and mean nothing on a customer's machine.
await rm(path.join(target, 'node_modules', '.bin'), { recursive: true, force: true });
