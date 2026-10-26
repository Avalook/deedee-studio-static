import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as parse5 from 'parse5';
import {
  assertLocalAssetsExist,
  normalizeRoutePath,
  resolveLocalRoute,
  resolveManifestAsset,
  resolveRouteTargets,
  routeFileFor,
  splitSrcsetCandidates,
} from './project-route-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_PATH = '/deedee-studio-static';
const SOURCE_ORIGIN = 'https://www.deedeestudio.net';
const MAX_CAPTURE_BYTES = 150 * 1024 * 1024;
const ROUTE_STATUS_PATH = path.join(ROOT, 'docs/ROUTE_STATUS.md');
const ROUTE_PATTERN = /^\| `([^`]+)` \|/;

function targetRoutesFromDocs(markdown) {
  return markdown.split('\n')
    .filter(line => line.includes('Chưa có trang chi tiết local'))
    .map(line => line.match(ROUTE_PATTERN)?.[1])
    .filter(Boolean);
}

function textContent(node) {
  if (node.nodeName === '#text') return node.value || '';
  return (node.childNodes || []).map(textContent).join(' ');
}

function findNode(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.childNodes || []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function removeRuntimeScripts(node) {
  if (!node.childNodes) return;
  node.childNodes = node.childNodes.filter(child => child.tagName !== 'script');
  for (const child of node.childNodes) removeRuntimeScripts(child);
}

function wixMediaUrlsInMarkup(markup) {
  const document = parse5.parse(markup);
  const urls = new Set();
  const visit = node => {
    if (node.tagName === 'script') return;
    for (const attr of node.attrs || []) {
      if (!['src', 'srcset', 'poster', 'style'].includes(attr.name)) continue;
      for (const match of attr.value.matchAll(/https?:\/\/static\.wixstatic\.com\/media\/[^\s"'<>),]+/gi)) {
        urls.add(match[0]);
      }
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(document);
  return [...urls];
}

function mediaId(url) {
  const match = String(url).match(/\/media\/([^/?#]+)/i);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

export function getPrimaryImageUrls(markup) {
  const document = parse5.parse(markup);
  const byId = new Map();
  const visit = node => {
    if (node.tagName === 'script') return;
    if (node.tagName === 'img') {
      const source = node.attrs?.find(attr => attr.name === 'src')?.value;
      const id = source && mediaId(source);
      if (id && !byId.has(id)) byId.set(id, source);
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(document);
  return byId;
}

export function pageMetadata(markup) {
  const document = parse5.parse(markup);
  const titleNode = findNode(document, node => node.tagName === 'title');
  const canonicalNode = findNode(document, node => node.tagName === 'link'
    && node.attrs?.some(attr => attr.name === 'rel' && attr.value.split(/\s+/).includes('canonical')));
  return {
    title: titleNode ? textContent(titleNode).trim() : '',
    canonical: canonicalNode?.attrs?.find(attr => attr.name === 'href')?.value || '',
  };
}

function validateSourcePage(record, allowedRoutes) {
  if (record.status !== 200) throw new Error(`${record.pathname}: HTTP ${record.status}`);
  const metadata = pageMetadata(record.markup);
  if (!metadata.title || !metadata.canonical) {
    throw new Error(`${record.pathname}: missing title or canonical evidence`);
  }
  const canonicalUrl = new URL(metadata.canonical, SOURCE_ORIGIN);
  if (canonicalUrl.origin !== SOURCE_ORIGIN) {
    throw new Error(`${record.pathname}: canonical points outside source domain: ${metadata.canonical}`);
  }
  const canonicalPathname = normalizeRoutePath(canonicalUrl.pathname);
  if (!allowedRoutes.includes(canonicalPathname)) {
    throw new Error(`${record.pathname}: canonical is outside approved route table: ${canonicalPathname}`);
  }
  if (record.markup.length < 50_000) {
    throw new Error(`${record.pathname}: source body is too small to be a rendered project page`);
  }
  return { ...metadata, canonicalPathname };
}

function encodeRoute(pathname) {
  return pathname.split('/').map((segment, index) => index === 0 ? '' : encodeURIComponent(segment)).join('/');
}

async function fetchRoute(pathname, fetchImpl) {
  const url = `${SOURCE_ORIGIN}${encodeRoute(pathname)}`;
  const response = await fetchImpl(url, { headers: { 'user-agent': 'DeeDee-static-route-backfill/1.0' } });
  return { pathname, status: response.status, finalUrl: response.url, markup: await response.text() };
}

function localMediaPath(sourceUrl, manifestAssets, newAssetPaths) {
  return resolveManifestAsset(sourceUrl, manifestAssets) || newAssetPaths.get(mediaId(sourceUrl)) || null;
}

function localizeUrl(rawValue, attributeName, pageRoute, manifestAssets, newAssetPaths, mappingMisses, availableRoutes) {
  if (!rawValue || /^(?:#|mailto:|tel:|javascript:|data:|blob:)/i.test(rawValue)) return rawValue;
  if (attributeName === 'srcset' || attributeName === 'imagesrcset') {
    return splitSrcsetCandidates(rawValue).map(({ url, descriptor }) => {
      const localizedUrl = localizeUrl(url, 'src', pageRoute, manifestAssets, newAssetPaths, mappingMisses, availableRoutes);
      return descriptor ? `${localizedUrl} ${descriptor}` : localizedUrl;
    }).join(', ');
  }
  const mediaLocal = rawValue.includes('static.wixstatic.com/media/')
    ? localMediaPath(rawValue, manifestAssets, newAssetPaths)
    : null;
  if (mediaLocal) return `${BASE_PATH}${mediaLocal.startsWith('/') ? mediaLocal : `/${mediaLocal}`}`;
  if (rawValue.includes('static.wixstatic.com/media/')) {
    mappingMisses.add(`${pageRoute}: ${rawValue}`);
    return rawValue;
  }
  const url = new URL(rawValue, `${SOURCE_ORIGIN}${encodeRoute(pageRoute)}`);
  if (url.origin !== SOURCE_ORIGIN) return rawValue;
  const pathname = resolveLocalRoute(decodeURIComponent(url.pathname), availableRoutes);
  return `${BASE_PATH}${pathname}${url.search}${url.hash}`;
}

function rewriteStyle(style, pageRoute, manifestAssets, newAssetPaths, mappingMisses, availableRoutes) {
  return style.replace(/url\((\s*["']?)([^"')]+)(["']?\s*)\)/gi, (whole, before, url, after) => {
    const updated = localizeUrl(url.trim(), 'src', pageRoute, manifestAssets, newAssetPaths, mappingMisses, availableRoutes);
    return `url(${before}${updated}${after})`;
  });
}

export function rewriteStaticMarkup(markup, pageRoute, manifestAssets, newAssetPaths, mappingMisses, availableRoutes) {
  const document = parse5.parse(markup);
  removeRuntimeScripts(document);
  const walk = node => {
    for (const attr of node.attrs || []) {
      if (['href', 'src', 'poster', 'srcset', 'imagesrcset'].includes(attr.name)) {
        attr.value = localizeUrl(attr.value, attr.name, pageRoute, manifestAssets, newAssetPaths, mappingMisses, availableRoutes);
      } else if (attr.name === 'style') {
        attr.value = rewriteStyle(attr.value, pageRoute, manifestAssets, newAssetPaths, mappingMisses, availableRoutes);
      } else if (attr.name === 'content' && node.tagName === 'meta') {
        const property = node.attrs.find(item => item.name === 'property')?.value;
        if (property === 'og:url') attr.value = `${BASE_PATH}${pageRoute}`;
      }
    }
    if (node.tagName === 'link' && node.attrs?.some(attr => attr.name === 'rel' && attr.value === 'canonical')) {
      const href = node.attrs.find(attr => attr.name === 'href');
      if (href) href.value = `${BASE_PATH}${pageRoute}`;
    }
    for (const child of node.childNodes || []) walk(child);
  };
  walk(document);
  return parse5.serialize(document);
}

function redirectMarkup(route, destination, title) {
  const target = `${BASE_PATH}${destination}`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0;url=${target}"></head><body><p>Trang đã chuyển sang <a href="${target}">${destination}</a>.</p></body></html>`;
}

function localPathFor(url, id) {
  const extension = path.extname(new URL(url).pathname.split('/').at(-1) || '') || '.bin';
  const hash = createHash('sha256').update(id).digest('hex').slice(0, 24);
  return `/assets/project-${hash}${extension}`;
}

async function estimateAssets(primaryUrls, existingAssets, fetchImpl) {
  const missing = [...primaryUrls.entries()].filter(([id]) => !Object.keys(existingAssets).some(url => mediaId(url) === id));
  const estimates = [];
  for (const [id, url] of missing) {
    const response = await fetchImpl(url, { method: 'HEAD', headers: { 'user-agent': 'DeeDee-static-route-backfill/1.0' } });
    if (response.status === 429) throw new Error(`Asset size check returned HTTP 429 for ${id}; stopped without retrying`);
    const bytes = Number(response.headers.get('content-length')) || 8 * 1024 * 1024;
    estimates.push({ id, url, bytes, status: response.status });
  }
  return estimates;
}

function manifestEntries(records, routeTargets) {
  return [...routeTargets.targets.values()].map(target => {
    const record = records.find(item => item.pathname === target.route);
    return {
      route: target.route,
      sourceRoute: target.route,
      title: target.page.title,
      file: target.file,
      canonicalRoute: target.kind === 'redirect' ? target.destination : target.route,
      captureStatus: record?.status ?? 200,
      finalUrl: record?.finalUrl ?? `${SOURCE_ORIGIN}${encodeRoute(target.route)}`,
      ...(target.kind === 'redirect' ? { redirectTo: target.destination } : {}),
    };
  });
}


function collectAvailableRoutes(root, manifest, targetPlan) {
  const routes = new Set(targetPlan.targets.keys());
  for (const page of manifest.pages) {
    if (page.file && existsSync(path.join(root, page.file))) routes.add(normalizeRoutePath(page.route));
  }
  return routes;
}

function updateRouteStatus(markdown, routeTargets) {
  return markdown.split('\n').map(line => {
    const route = line.match(ROUTE_PATTERN)?.[1];
    const target = route && routeTargets.targets.get(normalizeRoutePath(route));
    if (!target || !line.includes('Chưa có trang chi tiết local')) return line;
    const title = target.page.title.replaceAll('|', '\\|');
    const status = target.kind === 'redirect'
      ? `Alias local chuyển đến \`${target.destination}\`; nguồn canonical đã xác minh`
      : 'Trang chi tiết đã phục hồi từ Wix; title/canonical đã xác minh; asset path đã kiểm tra';
    return `| \`${route}\` | \`${target.file}\` | ${title} | ${status} |`;
  }).join('\n');
}

export async function restoreProjectRoutes({
  root = ROOT,
  fetchImpl = fetch,
  maxBytes = MAX_CAPTURE_BYTES,
  routes: requestedRoutes,
} = {}) {
  const docsPath = path.join(root, 'docs/ROUTE_STATUS.md');
  const manifestPath = path.join(root, 'manifest.json');
  const [markdown, manifest] = await Promise.all([
    readFile(docsPath, 'utf8'),
    readFile(manifestPath, 'utf8').then(JSON.parse),
  ]);
  const approvedRoutes = targetRoutesFromDocs(markdown);
  if (!approvedRoutes.length) throw new Error('No approved routes found in docs/ROUTE_STATUS.md');
  if (new Set(approvedRoutes).size !== approvedRoutes.length) throw new Error('Approved routes in docs/ROUTE_STATUS.md must be unique');
  const routes = requestedRoutes || approvedRoutes;
  if (!routes.length || routes.some(route => !approvedRoutes.includes(route))) {
    throw new Error('Requested routes must be a non-empty subset of the 60 approved routes');
  }
  const records = [];
  for (const route of routes) records.push(await fetchRoute(route, fetchImpl));
  const validated = records.map(record => ({ ...record, ...validateSourcePage(record, approvedRoutes) }));
  const targetPages = [...validated];
  for (const page of validated) {
    if (!targetPages.some(candidate => normalizeRoutePath(candidate.pathname) === page.canonicalPathname)) {
      targetPages.push({ ...page, pathname: page.canonicalPathname, canonicalPathname: page.canonicalPathname });
    }
  }
  const targetPlan = resolveRouteTargets(targetPages);
  const availableRoutes = collectAvailableRoutes(root, manifest, targetPlan);
  const canonicalPages = new Map(targetPages.map(page => [page.canonicalPathname, page]));
  const aliasCount = [...targetPlan.targets.values()].filter(target => target.kind === 'redirect').length;
  const pageMarkup = new Map();
  const mappingMisses = new Set();
  const primaryUrls = new Map();
  for (const [route, page] of canonicalPages) {
    const markup = rewriteStaticMarkup(page.markup, route, manifest.assets, new Map(), mappingMisses, availableRoutes);
    pageMarkup.set(route, markup);
    for (const [id, url] of getPrimaryImageUrls(page.markup)) {
      if (!Object.keys(manifest.assets).some(source => mediaId(source) === id) && !primaryUrls.has(id)) {
        primaryUrls.set(id, url);
      }
    }
  }
  const estimates = await estimateAssets(primaryUrls, manifest.assets, fetchImpl);
  const pageBytes = [...pageMarkup.values()].reduce((sum, markup) => sum + Buffer.byteLength(markup), 0);
  const redirectBytes = [...targetPlan.targets.values()]
    .filter(target => target.kind === 'redirect')
    .reduce((sum, target) => sum + Buffer.byteLength(redirectMarkup(target.route, target.destination, target.page.title)), 0);
  const projectedBytes = pageBytes + redirectBytes + estimates.reduce((sum, item) => sum + item.bytes, 0);
  if (projectedBytes > maxBytes) {
    throw new Error(`Backfill estimate ${projectedBytes} bytes exceeds ${maxBytes}; no generated files were written`);
  }

  const downloaded = [];
  for (const item of estimates) {
    const response = await fetchImpl(item.url, { headers: { 'user-agent': 'DeeDee-static-route-backfill/1.0' } });
    if (response.status === 429) throw new Error(`Asset request returned HTTP 429 for ${item.id}; stopped without retrying`);
    if (!response.ok) throw new Error(`Asset ${item.id}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    downloaded.push({ ...item, local: localPathFor(item.url, item.id), bytes });
  }
  const actualNewBytes = pageBytes + redirectBytes + downloaded.reduce((sum, item) => sum + item.bytes.length, 0);
  if (actualNewBytes > maxBytes) {
    throw new Error(`Actual backfill size ${actualNewBytes} bytes exceeds ${maxBytes}; no generated files were written`);
  }
  const newAssetPaths = new Map(downloaded.map(item => [item.id, item.local]));
  const newAssetManifest = Object.fromEntries(downloaded.map(item => [item.url, item.local]));
  mappingMisses.clear();
  for (const [route, page] of canonicalPages) {
    pageMarkup.set(route, rewriteStaticMarkup(page.markup, route, manifest.assets, newAssetPaths, mappingMisses, availableRoutes));
  }
  const outputFiles = [];
  for (const target of targetPlan.targets.values()) {
    const content = target.kind === 'redirect'
      ? redirectMarkup(target.route, target.destination, target.page.title)
      : pageMarkup.get(target.route);
    await assertLocalAssetsExist(content, root, {
      basePath: BASE_PATH,
      availablePaths: downloaded.map(item => item.local),
    });
    outputFiles.push({ ...target, content });
  }
  for (const item of downloaded) {
    const outputPath = path.join(root, item.local.slice(1));
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, item.bytes, { flag: 'wx' });
  }
  for (const output of outputFiles) {
    const outputPath = path.join(root, output.file);
    try { await stat(outputPath); throw new Error(`Refusing to overwrite existing target ${output.file}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output.content, { flag: 'wx' });
  }
  const pages = [...manifest.pages, ...manifestEntries(records, targetPlan)];
  const assets = { ...manifest.assets, ...newAssetManifest };
  await writeFile(manifestPath, JSON.stringify({ ...manifest, pages, assets }, null, 2));
  await writeFile(docsPath, updateRouteStatus(markdown, targetPlan));
  return {
    routes: routes.length,
    outputs: outputFiles.length,
    fullPages: pageMarkup.size,
    aliases: aliasCount,
    sourceBytes: records.reduce((sum, record) => sum + Buffer.byteLength(record.markup), 0),
    htmlBytes: pageBytes + redirectBytes,
    newAssets: downloaded.length,
    newAssetBytes: downloaded.reduce((sum, item) => sum + item.bytes.length, 0),
    mappingMisses: [...mappingMisses],
    projectedBytes,
    files: outputFiles.map(item => item.file),
  };
}


if (import.meta.url === `file://${process.argv[1]}`) {
  const pilotAlias = process.argv.indexOf('--pilot-alias');
  const requestedRoutes = pilotAlias >= 0 ? [process.argv[pilotAlias + 1]] : null;
  if (!requestedRoutes && !process.argv.includes('--all-approved')) {
    throw new Error('Choose --pilot-alias <route> for a bounded pilot or --all-approved after review');
  }
  restoreProjectRoutes({ routes: requestedRoutes || undefined }).then(result => {
    console.log(JSON.stringify(result, null, 2));
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
