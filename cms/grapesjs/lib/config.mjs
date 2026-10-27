import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const HOSTED = process.env.POC_HOSTED === '1';

export const ROOT = path.resolve(here, '..');
export const DATA_DIR = path.resolve(process.env.POC_DATA_DIR || path.join(ROOT, 'data'));
export const SEED_DIR = path.join(ROOT, 'seed');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const SHARED_DIR = path.resolve(ROOT, '..', 'shared');
export const GRAPES_DIST = path.join(ROOT, 'node_modules', 'grapesjs', 'dist');

export const HOST = process.env.POC_HOST || '127.0.0.1';
export const PORT = Number(process.env.POC_PORT || process.env.PORT || 4174);
export const STATIC_SITE_ORIGIN = process.env.POC_STATIC_SITE_ORIGIN || 'http://127.0.0.1:4173';

export const STATIC_SITE_DIR = path.resolve(process.env.POC_STATIC_SITE_DIR || path.join(ROOT, '..', '..'));
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const PREVIEW_TTL_MS = 15 * 60 * 1000;
export const MAX_JSON_BYTES = 8 * 1024 * 1024;
// Upload limits live in lib/media.mjs (images and short videos have different ceilings).

export const DEMO_USERS = [
  {
    id: 'user_editor',
    username: 'editor',
    role: 'editor',
    password: process.env.POC_EDITOR_PASSWORD || 'editor-demo',
  },
  {
    id: 'user_publisher',
    username: 'publisher',
    role: 'publisher',
    password: process.env.POC_PUBLISHER_PASSWORD || 'publisher-demo',
  },
];

export const LIMITS = {
  html: 2_000_000,
  css: 500_000,
  projectData: 6_000_000,
};

// Publishing also writes the files the static site needs (site-overrides.json, uploaded images, runtime).
export const EXPORT_DIR = path.resolve(process.env.CMS_EXPORT_DIR || STATIC_SITE_DIR);
export const EXPORT_ENABLED = process.env.CMS_EXPORT !== '0';
// Opt-in: commit the exported files and push the current branch so GitHub Pages updates.
export const GIT_PUSH_ENABLED = process.env.CMS_GIT_PUSH === '1';
