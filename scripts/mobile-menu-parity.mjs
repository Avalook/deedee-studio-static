import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MOBILE_MENU_STYLESHEET_HREF =
  '/deedee-studio-static/assets/mobile-menu-parity.css';
export const MOBILE_NAVIGATION_SCRIPT_HREF =
  '/deedee-studio-static/scripts/mobile-navigation.mjs';

const ROOT_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const EXCLUDED_DIRECTORIES = new Set(['.git', 'build', 'dist', 'node_modules']);
const LIVE_PAGE_EXCLUDED_DIRECTORIES = new Set([
  ...EXCLUDED_DIRECTORIES,
  'evidence',
  'original',
  'outputs',
]);

export function addMobileMenuStylesheet(html) {
  if (typeof html !== 'string') throw new TypeError('HTML must be a string');
  if (html.includes('data-deedee-mobile-menu-parity')) return html;

  const headEnd = html.toLowerCase().lastIndexOf('</head>');
  if (headEnd < 0) throw new Error('HTML has no closing head tag');

  const stylesheet = `  <link rel="stylesheet" data-deedee-mobile-menu-parity href="${MOBILE_MENU_STYLESHEET_HREF}">\n`;
  return `${html.slice(0, headEnd)}${stylesheet}${html.slice(headEnd)}`;
}

export function addMobileNavigationModule(html) {
  if (typeof html !== 'string') throw new TypeError('HTML must be a string');
  if (!html.includes('aria-label="Menu"')) return html;
  if (html.includes('scripts/mobile-navigation.mjs') || html.includes('scripts/site-controls.mjs')) return html;

  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) throw new Error('HTML has no closing body tag');

  const moduleScript = `  <script type="module" data-deedee-mobile-navigation src="${MOBILE_NAVIGATION_SCRIPT_HREF}"></script>\n`;
  return `${html.slice(0, bodyEnd)}${moduleScript}${html.slice(bodyEnd)}`;
}

async function collectHtmlFiles(directory, excludedDirectories = EXCLUDED_DIRECTORIES) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) return [];
      return collectHtmlFiles(entryPath, excludedDirectories);
    }
    return entry.isFile() && entry.name.endsWith('.html') ? [entryPath] : [];
  }));
  return nested.flat();
}

export async function installMobileMenuStylesheets(root = ROOT_DIRECTORY) {
  const htmlFiles = await collectHtmlFiles(root);
  let updated = 0;

  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf8');
    const nextHtml = addMobileMenuStylesheet(html);
    if (nextHtml === html) continue;
    await writeFile(filePath, nextHtml);
    updated += 1;
  }

  return { scanned: htmlFiles.length, updated };
}

export async function installMobileNavigationScripts(root = ROOT_DIRECTORY) {
  const htmlFiles = await collectHtmlFiles(root, LIVE_PAGE_EXCLUDED_DIRECTORIES);
  let updated = 0;

  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf8');
    const nextHtml = addMobileNavigationModule(html);
    if (nextHtml === html) continue;
    await writeFile(filePath, nextHtml);
    updated += 1;
  }

  return { scanned: htmlFiles.length, updated };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installMobileMenuStylesheets().then(result => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
