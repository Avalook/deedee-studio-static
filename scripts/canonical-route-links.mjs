import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const BASE_PATH = '/deedee-studio-static';
const LOCAL_ORIGIN = 'https://deedee-route-links.invalid';
const INTERNAL_HOSTS = new Set([
  'deedeestudio.net',
  'www.deedeestudio.net',
  'vi.deedeestudio.net',
  'en.deedeestudio.net',
  'deedee-route-links.invalid',
  'localhost',
  '127.0.0.1',
]);
const SOURCE_HOSTS = new Set([
  'deedeestudio.net',
  'www.deedeestudio.net',
  'vi.deedeestudio.net',
  'en.deedeestudio.net',
]);
const NON_SITE_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'assets',
  'cms',
  'docs',
  'outputs',
  'scripts',
  'tests',
]);
const SOURCE_ROUTE_ALIASES = new Map([
  ['/work', '/en/our-work'],
  ['/broken-being', '/en/all-project/broken-being:-the-prequel'],
  ['/why-us', '/en/aboutus'],
  ['/awaken', '/en/all-project/awaken'],
  ['/silverionsquad', '/en/all-project/the-silver-ion-squad'],
  ['/daihiep', '/en/all-project/the-hero'],
  ['/daivuongcuopvo', '/en/all-project/general,-please-mind-your-manner'],
  ['/dichvuquysu', '/en/all-project/the-naugh-nice-business'],
  ['/garena-gloriousmission', '/en/all-project/glorious-mission'],
  ['/layout-design-in-animation', '/en/post/different-approaches-layout-design'],
  ['/shekings', '/en/all-project/she-kings'],
  ['/vuigiaothong', '/en/all-project/fun-with-traffic'],
  ['/yeukieu', '/en/all-project/loving-kieu'],
]);
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function decodedPathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function normalizedRoute(pathname) {
  const decoded = decodedPathname(pathname);
  return decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded;
}

function internalPath(href) {
  const decodedEntities = href.replace(/&amp;/gi, '&');
  let url;
  try {
    url = new URL(decodedEntities, LOCAL_ORIGIN);
  } catch {
    return null;
  }
  if (!INTERNAL_HOSTS.has(url.hostname)) return null;
  let pathname = url.pathname;
  if (pathname === BASE_PATH) return null;
  if (pathname.startsWith(`${BASE_PATH}/`)) pathname = pathname.slice(BASE_PATH.length);
  return { pathname, route: normalizedRoute(pathname) };
}

/** Add the directory slash only when a URL exactly names a route in the manifest. */
function sourceRouteForUrl(url, language) {
  const hostname = url.hostname.toLowerCase();
  const pathname = normalizedRoute(url.pathname);
  if (hostname === 'en.deedeestudio.net') {
    if (pathname === '/') return '/en';
    return SOURCE_ROUTE_ALIASES.get(pathname) ?? (pathname === '/en' || pathname.startsWith('/en/') ? pathname : `/en${pathname}`);
  }
  if (hostname === 'vi.deedeestudio.net') return pathname;
  if (hostname === 'www.deedeestudio.net' || hostname === 'deedeestudio.net') {
    return pathname === '/' && language === 'en' ? '/en' : pathname;
  }
  return null;
}

function encodeLocalPath(route) {
  return route.split('/').map(segment => (segment ? encodeURIComponent(segment) : '')).join('/');
}

function localRouteHref(route, href) {
  const suffixStart = href.search(/[?#]/);
  const suffix = suffixStart < 0 ? '' : href.slice(suffixStart);
  const pathname = route === '/'
    ? `${BASE_PATH}/`
    : `${BASE_PATH}${encodeLocalPath(route)}/`;
  return `${pathname}${suffix}`;
}

function pageLanguage(document) {
  const htmlNode = descendants(document).find(node => node.tagName === 'html');
  const language = htmlNode?.attrs?.find(attribute => attribute.name === 'lang')?.value?.toLowerCase();
  return language?.startsWith('en') ? 'en' : 'vi';
}

function nodeText(node) {
  if (node.nodeName === '#text') return node.value ?? '';
  return (node.childNodes ?? []).map(nodeText).join('');
}

function taglineHomeHref(node, language, routes) {
  const href = node.attrs?.find(attribute => attribute.name === 'href');
  const classNames = node.attrs?.find(attribute => attribute.name === 'class')?.value?.split(/\s+/) ?? [];
  if (href?.value !== '' || !classNames.includes('wixui-rich-text__text')) return null;
  if (nodeText(node).trim() !== 'DeeDee Animation Studio') return null;
  const homeRoute = language === 'en' ? '/en' : '/';
  return routes.has(homeRoute) ? localRouteHref(homeRoute, '') : null;
}

export function canonicalizeRouteHref(href, routes, { language = 'vi' } = {}) {
  if (typeof href !== 'string' || !routes.has) return href;
  let url;
  try {
    url = new URL(href.replace(/&amp;/gi, '&'), LOCAL_ORIGIN);
  } catch {
    return href;
  }
  if (SOURCE_HOSTS.has(url.hostname)) {
    const route = sourceRouteForUrl(url, language);
    if (!route || !routes.has(normalizedRoute(route))) return href;
    return localRouteHref(normalizedRoute(route), href);
  }
  const target = internalPath(href);
  if (!target || !routes.has(target.route) || target.pathname.endsWith('/')) return href;
  const suffixStart = href.search(/[?#]/);
  if (suffixStart < 0) return `${href}/`;
  return `${href.slice(0, suffixStart)}/${href.slice(suffixStart)}`;
}

function descendants(node) {
  return (node.childNodes ?? []).flatMap(child => [child, ...descendants(child)]);
}

function routeSetFromPages(pages) {
  return new Set(pages.map(page => normalizedRoute(page.route)));
}

/** Rewrite only route-backed anchor/area href attributes while preserving other HTML bytes. */
function findRouteLinkReplacements(html, routes) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const language = pageLanguage(document);
  const replacements = [];
  for (const node of descendants(document)) {
    if (!['a', 'area'].includes(node.tagName)) continue;
    const attribute = node.attrs?.find(item => item.name === 'href');
    const location = node.sourceCodeLocation?.attrs?.href;
    if (!attribute || !location) continue;
    const rawAttribute = html.slice(location.startOffset, location.endOffset);
    const match = /^(\s*href\s*=\s*)(["'])([\s\S]*)\2$/i.exec(rawAttribute);
    if (!match) continue;
    const rawHref = match[3];
    const nextHref = taglineHomeHref(node, language, routes)
      ?? canonicalizeRouteHref(rawHref, routes, { language });
    if (nextHref === rawHref) continue;
    replacements.push({
      start: location.startOffset,
      end: location.endOffset,
      value: `${match[1]}${match[2]}${nextHref}${match[2]}`,
    });
  }
  return replacements;
}

export function rewriteRouteLinksHtml(html, routes) {
  return findRouteLinkReplacements(html, routes)
    .sort((left, right) => right.start - left.start)
    .reduce((result, replacement) => (
      result.slice(0, replacement.start)
      + replacement.value
      + result.slice(replacement.end)
    ), html);
}

export function createManifestRouteSet(pages) {
  return new Set(pages.map(page => normalizedRoute(page.route)));
}

export async function createLocalRouteSet(root, pages = []) {
  const routes = createManifestRouteSet(pages);
  async function visit(directory, relative = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || NON_SITE_DIRECTORIES.has(entry.name)) continue;
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const indexFile = path.join(directory, entry.name, 'index.html');
      try {
        await readFile(indexFile);
        routes.add(normalizedRoute(`/${childRelative}`));
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
      }
      await visit(path.join(directory, entry.name), childRelative);
    }
  }
  routes.add('/');
  await visit(root);
  return routes;
}

async function collectLocalPageFiles(root) {
  const files = new Set();
  async function visit(directory, relative = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || NON_SITE_DIRECTORIES.has(entry.name)) continue;
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const indexFile = path.join(directory, entry.name, 'index.html');
      try {
        await readFile(indexFile);
        files.add(`${childRelative}/index.html`);
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
      }
      await visit(path.join(directory, entry.name), childRelative);
    }
  }
  try {
    await readFile(path.join(root, 'index.html'));
    files.add('index.html');
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
  }
  await visit(root);
  return files;
}

function assertSafePageFile(root, file) {
  if (typeof file !== 'string' || path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) {
    throw new Error(`Manifest contains an unsafe page file path: ${file}`);
  }
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error(`Manifest page escapes the site root: ${file}`);
  }
  return absolute;
}

/** Repair route links across manifest pages without changing unrelated link targets. */
export async function repairInternalRouteLinks({
  root = DEFAULT_ROOT,
  includeProjectData = true,
  excludeFiles = [],
} = {}) {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.pages)) throw new Error('Manifest pages must be an array');
  const routes = await createLocalRouteSet(root, manifest.pages);
  let pagesChanged = 0;
  let linksChanged = 0;
  const excludedFiles = new Set(excludeFiles);

  const pageFiles = new Set(manifest.pages.map(page => page.file));
  for (const file of await collectLocalPageFiles(root)) pageFiles.add(file);
  for (const relativeFile of pageFiles) {
    if (excludedFiles.has(relativeFile)) continue;
    const file = assertSafePageFile(root, relativeFile);
    const html = await readFile(file, 'utf8');
    const replacementCount = findRouteLinkReplacements(html, routes).length;
    const updated = rewriteRouteLinksHtml(html, routes);
    if (updated === html) continue;
    const count = (html.match(/<a\b[^>]*\bhref\s*=/gi) ?? []).length;
    const updatedCount = (updated.match(/<a\b[^>]*\bhref\s*=/gi) ?? []).length;
    if (count !== updatedCount) throw new Error(`Anchor count changed while repairing ${relativeFile}`);
    pagesChanged += 1;
    linksChanged += replacementCount;
    await writeFile(file, updated);
  }

  let dataLinksChanged = 0;
  if (includeProjectData) {
    const projectDataPath = path.join(root, 'project-pages.json');
    try {
      const projectData = JSON.parse(await readFile(projectDataPath, 'utf8'));
      const updatedPages = projectData.pages.map(page => ({
        ...page,
        items: page.items.map(item => {
          const replacementCount = findRouteLinkReplacements(item, routes).length;
          dataLinksChanged += replacementCount;
          return rewriteRouteLinksHtml(item, routes);
        }),
      }));
      if (dataLinksChanged) {
        await writeFile(projectDataPath, JSON.stringify({ ...projectData, pages: updatedPages }));
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return { pagesChanged, linksChanged, dataLinksChanged };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await repairInternalRouteLinks();
  console.log(JSON.stringify(result));
}
