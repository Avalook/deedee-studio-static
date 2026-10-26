#!/usr/bin/env node
// Build a page in the other language from a page that already matches the live layout.
//   node transplant.mjs --base aboutus/index.html --live /en/aboutus --lang en --out en/aboutus/index.html
// Reads the hydrated live DOM (text only), swaps the words into the base HTML and fixes lang, title and links.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { collectTextNodes, transplantText } from '../../scripts/transplant-text.mjs';
import { counterpartPath } from '../../scripts/language-switch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.base || !args.live || !args.out || !['vi', 'en'].includes(args.lang)) {
  console.error('usage: --base <html> --live <route> --lang vi|en --out <html>');
  process.exit(2);
}
const BASE = '/deedee-studio-static';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto('https://www.deedeestudio.net' + args.live.split('/').map(encodeURIComponent).join('/'), { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(4000);
await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } scrollTo(0, 0); });
await page.waitForTimeout(1000);
const liveHtml = await page.evaluate(() => document.body.outerHTML);
const title = await page.title();
await browser.close();

const liveNodes = collectTextNodes(`<html><body>${liveHtml.replace(/^<body[^>]*>/, '').replace(/<\/body>$/, '')}</body></html>`);
const baseHtml = readFileSync(path.join(ROOT, args.base), 'utf8');
const { html: swapped, stats } = transplantText(baseHtml, liveNodes);

let out = swapped
  .replace(/<html lang="[^"]*"/, `<html lang="${args.lang}"`)
  .replace(/<title>[^<]*<\/title>/, `<title>${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>`);
const route = args.live.replace(/\/$/, '');
out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${BASE}${route}$2`);

// Internal links: point at the same page in the new language when that page exists in the mirror.
let relinked = 0;
out = out.replace(/(href=")(\/deedee-studio-static\/[^"#?]*)/g, (match, prefix, target) => {
  const english = target === `${BASE}/en` || target.startsWith(`${BASE}/en/`);
  if ((args.lang === 'en') === english) return match;
  const counterpart = counterpartPath(target);
  const file = path.join(ROOT, decodeURIComponent(counterpart.slice(BASE.length)).replace(/\/$/, ''), 'index.html');
  if (counterpart === `${BASE}/` || counterpart === `${BASE}/en` || existsSync(file)) { relinked += 1; return prefix + counterpart + (target.endsWith('/') && !counterpart.endsWith('/') ? '/' : ''); }
  return match;
});
writeFileSync(path.join(ROOT, args.out), out);
console.log(JSON.stringify({ out: args.out, lang: args.lang, title, relinked, ...stats }));
