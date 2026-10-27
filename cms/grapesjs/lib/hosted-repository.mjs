import { access, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);

/** Run fixed Git arguments; surface a safe error without token-bearing stderr. */
async function git(args, cwd) {
  try {
    return await exec('git', args, { cwd, timeout: 180_000, maxBuffer: 1024 * 1024 });
  } catch {
    throw new Error('Git repository operation failed. Check access, connectivity or branch conflicts.');
  }
}

/** Initialize a persistent, sparse main checkout without copying the media archive. */
export async function prepareRepository({ repoDir, repositoryUrl }) {
  await mkdir(path.dirname(repoDir), { recursive: true, mode: 0o700 });
  let exists = true;
  try { await access(path.join(repoDir, '.git')); } catch { exists = false; }
  if (!exists) {
    await git(['clone', '--depth=1', '--filter=blob:none', '--no-checkout', '--single-branch', '--branch', 'main',
      '--', repositoryUrl, repoDir], path.dirname(repoDir));
  }
  const remote = await git(['remote', 'get-url', 'origin'], repoDir);
  if (remote.stdout.trim() !== repositoryUrl) throw new Error('Persistent checkout has an unexpected remote');
  const branch = await git(['branch', '--show-current'], repoDir);
  if (branch.stdout.trim() !== 'main') throw new Error('Publish checkout must use main');
  await git(['config', 'user.name', 'DeeDee CMS'], repoDir);
  await git(['config', 'user.email', 'deedee-cms@users.noreply.github.com'], repoDir);
  // Reapply on every startup so earlier persistent deployments gain newly generated paths.
  await git(['sparse-checkout', 'set', '--no-cone', '/site-overrides.json', '/assets/cms/',
    '/scripts/cms-runtime.js', '/content.json', '/post/', '/all-project/', '/en/post/', '/en/all-project/',
    '/scripts/content-cards.mjs', '/scripts/content-cards.css', '/scripts/site-controls.mjs'], repoDir);
  if (!exists) await git(['checkout', 'main'], repoDir);
  await syncRepository(repoDir);
}

/** Refuse dirty/diverged checkouts rather than overwrite another publisher's work. */
export async function syncRepository(repoDir) {
  const branch = await git(['branch', '--show-current'], repoDir);
  if (branch.stdout.trim() !== 'main') throw new Error('Publish checkout must use main');
  const status = await git(['status', '--porcelain'], repoDir);
  if (status.stdout.trim()) throw new Error('Publish checkout has uncommitted files; recover it before retrying');
  await git(['fetch', '--deepen=50', 'origin', 'main'], repoDir);
  await git(['merge', '--ff-only', 'FETCH_HEAD'], repoDir);
}
