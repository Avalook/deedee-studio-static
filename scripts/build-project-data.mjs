import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateProjectData } from './site-controls.mjs';
import { createLocalRouteSet, rewriteRouteLinksHtml } from './canonical-route-links.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const capturePath = path.resolve(root, '../../work/nav-audit/project-pages-raw.json');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const routes = await createLocalRouteSet(root, manifest.pages);
const captured = JSON.parse(await readFile(capturePath, 'utf8'));
const thumbs = new Map();
const thumbExt = new Map([['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/avif', '.avif']]);
function safeThumbnailUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'static.wixstatic.com' && url.pathname.startsWith('/media/') ? url.href : null;
  } catch { return null; }
}
async function localThumbnail(url) {
  if (thumbs.has(url)) return thumbs.get(url);
  const asset = manifest.assets[url];
  if (asset) { thumbs.set(url, asset); return asset; }
  const safe = safeThumbnailUrl(url);
  if (!safe) throw new Error('Rejected an external project thumbnail URL');
  const response = await fetch(safe, { signal: AbortSignal.timeout(20000), redirect: 'error' });
  const extension = thumbExt.get((response.headers.get('content-type') || '').split(';')[0].toLowerCase());
  if (!response.ok || !extension || Number(response.headers.get('content-length')) > 6 * 1024 * 1024) throw new Error(`Invalid project thumbnail response for ${safe}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 6 * 1024 * 1024) throw new Error(`Project thumbnail is too large: ${safe}`);
  const local = `/assets/project-${createHash('sha256').update(safe).digest('hex').slice(0, 20)}${extension}`;
  await writeFile(path.join(root, local.slice(1)), bytes);
  thumbs.set(url, local);
  return local;
}
const pages = [];
for (const capture of captured) {
  const pageSize = capture.counts[0] === 6 ? 6 : 9;
  const items = [];
  for (const source of capture.items) {
    let html = source.replaceAll('https://www.deedeestudio.net', '/deedee-studio-static');
    for (const [remote, local] of Object.entries(manifest.assets)) {
      if (!remote.startsWith('https://static.wixstatic.com/media/')) continue;
      html = html.replaceAll(remote, `/deedee-studio-static${local}`);
    }
    const remoteImages = [...new Set([...html.matchAll(/(?:src|srcset)="([^"]+)"/g)].flatMap(match => match[1].split(/,\s+(?=https?:\/\/)/).map(value => value.trim().split(/\s+/)[0]).filter(value => value.startsWith('https://static.wixstatic.com/media/'))))];
    for (const remote of remoteImages) html = html.replaceAll(remote, `/deedee-studio-static${await localThumbnail(remote)}`);
    items.push(rewriteRouteLinksHtml(html, routes));
  }
  pages.push({ route: capture.route, panel: capture.panel, repeatId: capture.repeatId, buttonId: capture.buttonId, pageSize, items });
}
const data = { pages: validateProjectData({ pages }) };
await writeFile(path.join(root, 'project-pages.json'), JSON.stringify(data));
console.log(JSON.stringify({ pages: pages.length, cards: pages.reduce((sum, page) => sum + page.items.length, 0) }));
