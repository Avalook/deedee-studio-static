import { parse } from 'parse5';
import { originalMediaUrl } from './restore-placeholder-assets.mjs';
import { repairBackgrounds } from './backgrounds.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

/** Traverse rendered HTML while keeping script text and template content inert. */
function nodesIn(html) {
  const pending = [parse(html)];
  const result = [];
  while (pending.length) {
    const node = pending.pop();
    result.push(node);
    pending.push(...(node.childNodes || []));
  }
  return result;
}

/** Collect only static Wix fill backgrounds, excluding poster and effect types. */
export function collectShapeBackgrounds(html) {
  const result = [];
  for (const node of nodesIn(html)) {
    if (node.tagName !== 'wow-image') continue;
    const attrs = Object.fromEntries(node.attrs.map(item => [item.name, item.value]));
    if (!attrs.class?.split(/\s+/).includes('bgImage')) continue;
    let info;
    try { info = JSON.parse(attrs['data-image-info'] || '{}'); }
    catch (cause) { throw new Error('Invalid Wix background metadata', { cause }); }
    const image = info.imageData;
    if (info.displayMode !== 'fill' || attrs['data-bg-effect-name'] || image?.hasAnimation) continue;
    if (!image?.uri || !(image.width > 0 && image.height > 0)) continue;
    originalMediaUrl(image.uri);
    result.push({ uri: image.uri, width: image.width, height: image.height });
  }
  return result;
}

/**
 * Strip the old footer "feedback" CSS (single-row labels, negative top margin). The live Wix footer wraps its
 * six labels onto two rows at every desktop width (1280-2560px), so the override made local pages diverge.
 */
export function repairFooterHtml(html) {
  return html.replace(/<style data-deedee-footer-repairs>[\s\S]*?<\/style>/g, '');
}

export function repairInteractiveRuntime(html, basePath = '/deedee-studio-static') {
  if (html.includes('data-deedee-site-controls')) return html;
  const script = `<script type="module" data-deedee-site-controls src="${basePath}/scripts/site-controls.mjs"></script>`;
  return html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
}

export function repairMediaRuntime(html, basePath = '/deedee-studio-static') {
  if (html.includes('data-deedee-media-motion')) return html;
  const script = `<script type="module" data-deedee-media-motion src="${basePath}/scripts/media-motion.mjs"></script>`;
  return html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
}

export function repairAssetBasePath(html, basePath = '/deedee-studio-static') {
  return html.replace(/(?<=["'(])\/assets\//g, `${basePath}/assets/`);
}

/** Repair every known static fill section using the exact untransformed Wix asset. */
export async function repairShapeBackgroundPages(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const media = JSON.parse(await readFile(path.join(root, 'media-sources.json'), 'utf8'));
  const sources = {
    '7181ac_cdb39d9a44de432aa1512b03efc83681~mv2.png': '/assets/home-services-original.png',
    '7181ac_182524c823b840f99b9d42f1c9db772f~mv2.png': '/assets/home-projects-original.png',
    '398383_e3fa2f0ed7da4689b2e7a4ecc6f0e2e7~mv2.png': '/assets/home-services-mobile-original.png',
    '398383_a055e15dc8414f218584da4f605063aa~mv2.png': '/assets/home-projects-mobile-original.png',
  };
  const backgrounds = new Map();
  for (const entry of manifest.pages) {
    const file = path.resolve(root, entry.file);
    if (!file.startsWith(root + path.sep)) throw new Error('Page outside site root');
    const html = await readFile(file, 'utf8');
    for (const image of collectShapeBackgrounds(html)) {
      backgrounds.set(image.uri, image);
    }
  }
  for (const [uri, image] of backgrounds) {
    if (sources[uri]) continue;
    const known = manifest.assets[originalMediaUrl(uri)];
    if (known && /^\/assets\/[a-zA-Z0-9._-]+$/.test(known) && !/\/v1\//.test(known)) {
      sources[uri] = known;
      continue;
    }
    const extension = path.extname(uri).toLowerCase();
    const local = `/assets/shape-${createHash('sha256').update(uri).digest('hex').slice(0, 20)}${extension}`;
    const target = path.join(root, local.slice(1));
    try {
      await readFile(target);
    } catch {
      const response = await fetch(originalMediaUrl(uri), { signal: AbortSignal.timeout(30000), redirect: 'error' });
      if (!response.ok || !/^image\//i.test(response.headers.get('content-type') || '') || Number(response.headers.get('content-length')) > 30 * 1024 * 1024) throw new Error(`Could not fetch original shape ${uri}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 30 * 1024 * 1024) throw new Error(`Invalid original shape size: ${uri}`);
      await writeFile(target, bytes);
    }
    sources[uri] = local;
  }
  let changedPages = 0;
  for (const entry of manifest.pages) {
    const file = path.resolve(root, entry.file);
    const html = await readFile(file, 'utf8');
    const fixed = repairInteractiveRuntime(repairAssetBasePath(repairFooterHtml(repairBackgrounds(html, sources, '/deedee-studio-static'))));
    const localeRoute = entry.route.replace(/\/$/, '') || '/';
    const withMedia = media.pages[localeRoute] ? repairMediaRuntime(fixed) : fixed;
    if (withMedia === html) continue;
    await writeFile(file, withMedia);
    changedPages += 1;
  }
  return { changedPages, knownBackgrounds: Object.keys(sources).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await repairShapeBackgroundPages())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
