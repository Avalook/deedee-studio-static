import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WIX_ASSET_TRANSFORM_PATTERN =
  /((?:\/deedee-studio-static)?\/assets\/[^"'`\s<>?#)]+?\.(?:avif|gif|jpe?g|png|svg|webp))\/v1\/[^"'`\s<>?#)]*/gi;

function localAssetPath(root, urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const sitePrefix = '/deedee-studio-static/';
  if (decodedPath.startsWith(sitePrefix)) {
    decodedPath = decodedPath.slice(sitePrefix.length);
  } else {
    decodedPath = decodedPath.replace(/^\/+/, '');
  }

  const resolvedRoot = path.resolve(root);
  const resolvedAsset = path.resolve(resolvedRoot, decodedPath);
  const relativePath = path.relative(resolvedRoot, resolvedAsset);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return resolvedAsset;
}

export function stripWixAssetTransforms(html, assetExists = () => true) {
  let rewritten = 0;
  let skipped = 0;
  const repairedHtml = String(html).replace(
    WIX_ASSET_TRANSFORM_PATTERN,
    (match, localUrlPath) => {
      if (!assetExists(localUrlPath)) {
        skipped += 1;
        return match;
      }
      rewritten += 1;
      return localUrlPath;
    }
  );

  return { html: repairedHtml, rewritten, skipped };
}

export function repairTransformedAssets(root = process.cwd()) {
  const resolvedRoot = path.resolve(root);
  const manifestPath = path.join(resolvedRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.pages)) {
    throw new TypeError('manifest.json must contain a pages array');
  }

  let pagesChanged = 0;
  let referencesRewritten = 0;
  let referencesSkipped = 0;

  for (const page of manifest.pages) {
    if (typeof page.file !== 'string' || page.file.length === 0) {
      throw new TypeError('Every manifest page must have a local file path');
    }
    const pagePath = path.resolve(resolvedRoot, page.file);
    const relativePagePath = path.relative(resolvedRoot, pagePath);
    if (relativePagePath.startsWith('..') || path.isAbsolute(relativePagePath)) {
      throw new Error(`Manifest page path escapes the site root: ${page.file}`);
    }
    if (!fs.existsSync(pagePath)) {
      throw new Error(`Manifest page is missing: ${page.file}`);
    }

    const html = fs.readFileSync(pagePath, 'utf8');
    const result = stripWixAssetTransforms(html, urlPath => {
      const assetPath = localAssetPath(resolvedRoot, urlPath);
      return Boolean(assetPath && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile());
    });
    referencesRewritten += result.rewritten;
    referencesSkipped += result.skipped;
    if (result.html !== html) {
      fs.writeFileSync(pagePath, result.html);
      pagesChanged += 1;
    }
  }

  return { pagesChanged, referencesRewritten, referencesSkipped };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const summary = repairTransformedAssets();
  console.log(JSON.stringify(summary, null, 2));
}
