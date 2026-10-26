import { access } from 'node:fs/promises';
import path from 'node:path';

const MEDIA_ID_PATTERN = /\/media\/([^/?#]+)/i;
const ASSET_REFERENCE_PATTERN = /(?:\/deedee-studio-static)?\/assets\/[^\s"'<>),;]+/g;

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

export function normalizeRoutePath(value) {
  const pathname = value.startsWith('http') ? new URL(value).pathname : value;
  const decoded = decodePathname(pathname);
  return decoded.length > 1 ? decoded.replace(/\/$/, '') : decoded;
}


export function resolveLocalRoute(pathname, availableRoutes) {
  const route = normalizeRoutePath(pathname);
  if (availableRoutes.has(route)) return route;
  if (route.startsWith('/en/') && availableRoutes.has(route.slice(3))) return route.slice(3);
  return route;
}

export function routeFileFor(pathname) {
  const route = normalizeRoutePath(pathname);
  if (!route.startsWith('/') || route.split('/').includes('..')) {
    throw new Error(`Unsafe route path: ${pathname}`);
  }
  return `${route.slice(1)}/index.html` || 'index.html';
}

export function resolveRouteTargets(pages) {
  const routes = new Map(pages.map(page => [normalizeRoutePath(page.pathname), page]));
  const targets = new Map();

  for (const [pathname, page] of routes) {
    const canonical = normalizeRoutePath(page.canonicalPathname || pathname);
    if (canonical === pathname) {
      targets.set(pathname, { kind: 'page', route: pathname, file: routeFileFor(pathname), page });
      continue;
    }
    if (!routes.has(canonical)) {
      throw new Error(`Canonical route ${canonical} is outside the approved target routes (${pathname})`);
    }
    targets.set(pathname, {
      kind: 'redirect',
      route: pathname,
      file: routeFileFor(pathname),
      destination: canonical,
      page,
    });
  }
  return { routes, targets };
}

function mediaId(url) {
  const match = String(url).match(MEDIA_ID_PATTERN);
  if (!match) return null;
  return decodePathname(match[1]);
}

export function resolveManifestAsset(sourceUrl, manifestAssets) {
  if (manifestAssets[sourceUrl]) return manifestAssets[sourceUrl];
  const requestedId = mediaId(sourceUrl);
  if (!requestedId) return null;

  const candidates = Object.entries(manifestAssets)
    .filter(([url]) => mediaId(url) === requestedId)
    .map(([, localPath]) => localPath);
  return candidates[0] || null;
}


export function splitSrcsetCandidates(srcset) {
  if (!srcset || typeof srcset !== 'string') return [];
  const trimmed = srcset.trim();
  if (!trimmed) return [];

  const candidates = [];
  const candidatePattern = /\s*([^\s,]+(?:,[^\s,]+)*)(?:\s+([\d.]+[wx]))?(?:\s*,\s*|\s*$)/g;
  let match;
  while ((match = candidatePattern.exec(trimmed)) !== null) {
    if (match[1]) {
      candidates.push({ url: match[1], descriptor: match[2] || '' });
    }
    if (match.index === candidatePattern.lastIndex) candidatePattern.lastIndex++;
  }
  return candidates;
}

function assetPathFromReference(reference, basePath) {
  const normalized = reference.startsWith(basePath)
    ? reference.slice(basePath.length)
    : reference;
  if (!normalized.startsWith('/assets/')) return null;
  return normalized.slice(1);
}

export async function assertLocalAssetsExist(html, root, { basePath = '/deedee-studio-static', availablePaths = [] } = {}) {
  const references = [...new Set(html.match(ASSET_REFERENCE_PATTERN) || [])];
  const available = new Set(availablePaths.map(value => value.replace(/^\//, '')));
  const missing = [];
  for (const reference of references) {
    const relative = assetPathFromReference(reference, basePath);
    if (!relative || available.has(relative)) continue;
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) {
      throw new Error(`Unsafe local asset path: ${reference}`);
    }
    try {
      await access(absolute);
    } catch {
      missing.push(reference);
    }
  }
  if (missing.length) throw new Error(`Missing local asset path(s): ${missing.join(', ')}`);
  return references.length;
}
