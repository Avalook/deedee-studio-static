import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chmod } from 'node:fs/promises';
import { prepareRepository } from './lib/hosted-repository.mjs';
import { validateHostedEnvironment } from './lib/hosted-config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
Object.assign(env, {
  POC_HOSTED: '1', POC_HOST: '0.0.0.0',
  POC_ORIGIN: env.POC_ORIGIN || env.RENDER_EXTERNAL_URL || '',
  POC_DATA_DIR: env.POC_DATA_DIR || '/var/data/cms',
  CMS_EXPORT_DIR: env.CMS_EXPORT_DIR || '/var/data/publish',
  POC_STATIC_SITE_ORIGIN: 'https://avalook.github.io/deedee-studio-static/',
  CMS_EXPORT: '1', CMS_GIT_PUSH: '1', GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: path.join(root, 'git-askpass.mjs'),
});
try {
  validateHostedEnvironment(env);
  if (!env.CMS_GITHUB_TOKEN) throw new Error('CMS_GITHUB_TOKEN is required for publishing');
  await chmod(env.GIT_ASKPASS, 0o700);
  await prepareRepository({ repoDir: env.CMS_EXPORT_DIR,
    repositoryUrl: 'https://github.com/Avalook/deedee-studio-static.git' });
  await import('./server.mjs');
} catch (error) {
  console.error(`CMS startup refused: ${error.message}`);
  process.exitCode = 1;
}
