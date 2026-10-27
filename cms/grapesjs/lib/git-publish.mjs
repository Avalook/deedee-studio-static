import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Optional: commit the exported files and push them so GitHub Pages updates (CMS_GIT_PUSH=1).
 * Arguments are fixed (no shell); only the exported paths are staged, and only the current branch is pushed.
 */
export async function commitAndPush({ repoDir, files, message, push = true, git = 'git' }) {
  const options = { cwd: repoDir, timeout: 120_000, maxBuffer: 1024 * 1024 };
  await run(git, ['add', '--', ...files], options);
  const status = await run(git, ['status', '--porcelain', '--', ...files], options);
  const committed = Boolean(status.stdout.trim());
  if (committed) await run(git, ['commit', '-m', message, '--', ...files], options);
  if (!push) return { committed, pushed: false };
  // Retry pushes even when a previous request committed successfully but lost its connection.
  await run(git, ['push', 'origin', 'HEAD'], options);
  return { committed, pushed: true };
}
