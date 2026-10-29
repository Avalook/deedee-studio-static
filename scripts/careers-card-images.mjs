// The English careers page lists the same posts as /en/news, but kept tiny blurred placeholders for most thumbnails.
// Reuse the sharp card image the news page already shows for the same post. Idempotent, no downloads.
//   node scripts/careers-card-images.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/deedee-studio-static';
const IMG = /<img\b[^>]*data-hook="gallery-item-image-img"[^>]*?\ssrc="([^"]+)"/g;
const POST = /href="(?:\/deedee-studio-static)?\/(?:en\/)?post\/([^"/]+)\/?"/;

/** slug -> thumbnail src, taking the first card image found before each post link. */
export function cardImages(html) {
  const found = new Map();
  const matches = [...html.matchAll(IMG)];
  for (const [i, match] of matches.entries()) {
    const end = matches[i + 1]?.index ?? html.length;
    const slug = html.slice(match.index, end).match(POST)?.[1];
    if (slug && !found.has(slug)) found.set(slug, match[1]);
  }
  return found;
}

export function useSharpImages(careersHtml, newsImages, fileExists = () => true) {
  let changed = 0;
  const matches = [...careersHtml.matchAll(IMG)];
  let out = careersHtml; let shift = 0;
  for (const [i, match] of matches.entries()) {
    const end = matches[i + 1]?.index ?? careersHtml.length;
    const slug = careersHtml.slice(match.index, end).match(POST)?.[1];
    const better = slug && newsImages.get(slug);
    if (!better || better === match[1] || !fileExists(better)) continue;
    const start = match.index + match[0].length - match[1].length - 1 + shift;
    out = out.slice(0, start) + better + out.slice(start + match[1].length);
    shift += better.length - match[1].length; changed += 1;
  }
  return { html: out, changed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const news = cardImages(readFileSync(path.join(ROOT, 'en/news/index.html'), 'utf8'));
  const file = path.join(ROOT, 'en/careers/index.html');
  const { html, changed } = useSharpImages(readFileSync(file, 'utf8'), news, (src) => existsSync(path.join(ROOT, src.replace(BASE, ''))));
  if (changed) writeFileSync(file, html);
  console.log(`en/careers: ${changed} card images replaced (news page knows ${news.size} posts)`);
}
