import { access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { prepareRepository, resetCheckout } from './lib/hosted-repository.mjs';

// Started by the desktop app (cms/desktop), which supplies the data folders and the Git credentials through the environment.
const exec = promisify(execFile);
const SITE = 'https://avalook.github.io/deedee-studio-static';
const REPOSITORY = 'https://github.com/Avalook/deedee-studio-static.git';
export const EXIT_NO_ACCESS = 3;
// Every page, so SEO edits can be written into them, without the media archive the pages only link to.
const CHECKOUT = ['/*', '!/assets/*', '/assets/cms/', '!/cms/', '!/docs/', '!/tests/', '!/tools/'];

const env = process.env;
const repoDir = env.CMS_EXPORT_DIR;
Object.assign(env, {
  POC_HOST: '127.0.0.1', POC_HOSTED: '0', POC_STATIC_SITE_DIR: repoDir, POC_STATIC_SITE_ORIGIN: `${SITE}/`,
  CMS_SITE_ORIGIN: SITE, CMS_EXPORT: '1', CMS_GIT_PUSH: '1', GIT_TERMINAL_PROMPT: '0',
});

async function canPush() {
  try {
    await exec('git', ['push', '--dry-run', 'origin', 'HEAD:refs/heads/main'], { cwd: repoDir, timeout: 60_000 });
    return true;
  } catch {
    return false;
  }
}

try {
  const repositoryUrl = env.DEEDEE_TEST_REMOTE || REPOSITORY;
  if (await access(path.join(repoDir, '.git')).then(() => true, () => false)) await resetCheckout(repoDir);
  await prepareRepository({ repoDir, repositoryUrl, sparsePaths: CHECKOUT });
  if (!await canPush()) {
    console.error('CMS startup refused: this activation code cannot publish to the website repository.');
    process.exit(EXIT_NO_ACCESS);
  }
  await import('./server.mjs');
} catch (error) {
  console.error(`CMS startup refused: ${error.message}`);
  process.exitCode = 1;
}
