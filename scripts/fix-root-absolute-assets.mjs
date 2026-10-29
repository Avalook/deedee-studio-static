// The 2x candidates of some image srcsets point at /assets/<file> without the GitHub Pages prefix, so Retina screens
// request a URL that 404s. Put the prefix back everywhere. Idempotent.
//   node scripts/fix-root-absolute-assets.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/deedee-studio-static';
// A standalone "/assets/" (not part of a longer path such as /deedee-studio-static/assets/ or ../assets/).
export const ROOT_ASSET = /(?<![\w\-/.])\/assets\//g;

export function fixHtml(html) {
  let count = 0;
  const fixed = html.replace(ROOT_ASSET, () => { count += 1; return `${BASE}/assets/`; });
  return { html: fixed, count };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pages = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).pages;
  let files = 0; let refs = 0;
  for (const page of pages) {
    const file = path.join(ROOT, page.file);
    const { html, count } = fixHtml(readFileSync(file, 'utf8'));
    if (count) { writeFileSync(file, html); files += 1; refs += count; }
  }
  console.log(`fixed ${refs} references in ${files} pages`);
}
