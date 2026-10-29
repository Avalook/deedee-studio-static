#!/usr/bin/env node
// Static health check of the mirror: every page's local files must exist, internal links must land on a page,
// and we list which outside hosts the pages still depend on.
//   node health.mjs            -> evidence/health.json + a short summary on stdout
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BASE = '/deedee-studio-static';
const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
const routes = new Set(manifest.pages.map((page) => page.route));
const exists = new Map();
async function has(file) {
  if (!exists.has(file)) exists.set(file, stat(file).then((s) => s.isFile() || s.isDirectory(), () => false));
  return exists.get(file);
}
const decode = (value) => { try { return decodeURIComponent(value); } catch { return value; } };

/** Map a reference found in a page to a file on disk (null = not a local reference). */
function toLocal(ref, pageDir) {
  const clean = ref.split('#')[0].split('?')[0].trim();
  if (!clean || /^(data:|mailto:|tel:|javascript:|blob:|about:)/i.test(clean)) return null;
  if (/^https?:\/\//i.test(clean) || clean.startsWith('//')) return null;
  const rel = clean.startsWith('/') ? (clean.startsWith(`${BASE}/`) || clean === BASE ? clean.slice(BASE.length) : null) : path.posix.join(pageDir, clean);
  if (rel === null) return { outside: clean };
  return { file: path.join(ROOT, decode(rel)), route: decode(rel).replace(/\/index\.html$/, '').replace(/\/$/, '') || '/' };
}

const missing = new Map(); const brokenLinks = new Map(); const external = new Map();
const note = (map, key, page) => { const entry = map.get(key) ?? { pages: 0, example: page }; entry.pages += 1; map.set(key, entry); };
let checked = 0;
await Promise.all(manifest.pages.map(async (page) => {
  let html;
  try { html = await readFile(path.join(ROOT, page.file), 'utf8'); } catch { note(missing, `PAGE FILE ${page.file}`, page.route); return; }
  checked += 1;
  const pageDir = '/' + path.posix.dirname(page.file).replace(/^\.$/, '');
  const refs = new Set();
  for (const match of html.matchAll(/\b(?:src|href|poster|data-src|data-href)\s*=\s*"([^"]*)"/gi)) refs.add(['attr', match[1], /<a\b[^>]*$/i.test(html.slice(Math.max(0, match.index - 200), match.index))]);
  for (const match of html.matchAll(/\bsrcset\s*=\s*"([^"]*)"/gi)) for (const part of match[1].split(/,\s+/)) refs.add(['attr', part.trim().split(/\s+/)[0], false]);
  for (const match of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) refs.add(['css', match[1], false]);
  for (const [, ref, isLink] of refs) {
    if (!/[\/.]/.test(ref)) continue; // plain words such as href="true" are not files
    const local = toLocal(ref, pageDir);
    if (local === null) { const host = ref.match(/^(?:https?:)?\/\/([^/]+)/i)?.[1]; if (host) note(external, host, page.route); continue; }
    if (local.outside) { note(missing, `OUTSIDE BASE ${local.outside}`, page.route); continue; }
    if (isLink) {
      const ok = routes.has(local.route) || await has(local.file) || await has(path.join(local.file, 'index.html'));
      if (!ok) note(brokenLinks, ref, page.route);
    } else if (!(await has(local.file)) && !(await has(path.join(local.file, 'index.html')))) note(missing, ref, page.route);
  }
}));
const sort = (map) => [...map.entries()].sort((a, b) => b[1].pages - a[1].pages).map(([ref, v]) => ({ ref, ...v }));
const report = { checkedPages: checked, missingFiles: sort(missing), brokenLinks: sort(brokenLinks), externalHosts: sort(external) };
await mkdir(path.join(ROOT, 'evidence'), { recursive: true });
await writeFile(path.join(ROOT, 'evidence/health.json'), JSON.stringify(report, null, 2));
console.log(`pages checked: ${checked}/${manifest.pages.length}`);
console.log(`missing local files: ${report.missingFiles.length}`); for (const m of report.missingFiles.slice(0, 15)) console.log(`  ${m.pages}x  ${m.ref.slice(0, 110)}   e.g. ${m.example}`);
console.log(`broken internal links: ${report.brokenLinks.length}`); for (const m of report.brokenLinks.slice(0, 15)) console.log(`  ${m.pages}x  ${m.ref.slice(0, 110)}   e.g. ${m.example}`);
console.log(`outside hosts the pages still load from:`); for (const m of report.externalHosts.slice(0, 12)) console.log(`  ${m.pages}x  ${m.ref}`);
