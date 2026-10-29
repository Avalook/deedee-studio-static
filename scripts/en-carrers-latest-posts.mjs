// /en/carrers lists three activity cards; live now shows the three newest posts, which are also the first three cards
// of /en/careers. Copy their title, link and thumbnail into the three cards of /en/carrers. Idempotent.
//   node scripts/en-carrers-latest-posts.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ITEM = /(?=<div\b[^>]*data-hook="item-container")/;
const SLUG = /\/en\/post\/([^/"]+)\//;
const ALT = /<img\b[^>]*\balt="([^"]*)"/;
const SRC = /<img\b[^>]*\bsrc="([^"]+)"/g;

/** Cards of one gallery as { slug, title (raw HTML text), images[] } plus the raw segments. */
export function cards(html, galleryId) {
  const start = html.indexOf(`id="pro-gallery-${galleryId}"`);
  if (start < 0) throw new Error(`gallery ${galleryId} not found`);
  const parts = html.slice(start).split(ITEM).slice(1);
  return parts.map((raw) => {
    const slug = raw.match(SLUG)?.[1]; const title = raw.match(ALT)?.[1];
    return { slug, title, images: [...raw.matchAll(SRC)].map((m) => m[1]) };
  });
}

/** Rewrite the first `wanted.length` cards of `galleryId` in `html` to show the wanted posts. */
export function retarget(html, galleryId, wanted) {
  const start = html.indexOf(`id="pro-gallery-${galleryId}"`);
  const head = html.slice(0, start); const parts = html.slice(start).split(ITEM);
  let changed = 0;
  for (const [i, want] of wanted.entries()) {
    const raw = parts[i + 1]; if (!raw) continue;
    const slug = raw.match(SLUG)?.[1]; const title = raw.match(ALT)?.[1];
    const images = [...new Set([...raw.matchAll(SRC)].map((m) => m[1]))];
    if (!slug || slug === want.slug) continue;
    let next = raw.split(slug).join(want.slug);
    if (title) next = next.split(title).join(want.title);
    for (const image of images) next = next.split(`src="${image}"`).join(`src="${want.images.at(-1)}"`);
    parts[i + 1] = next; changed += 1;
  }
  return { html: head + parts.join(''), changed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const careers = readFileSync(path.join(ROOT, 'en/careers/index.html'), 'utf8');
  const wanted = cards(careers, 'comp-m8cy9ggi').slice(0, 3);
  const file = path.join(ROOT, 'en/carrers/index.html');
  const { html, changed } = retarget(readFileSync(file, 'utf8'), 'comp-m8hitxkn', wanted);
  if (changed) writeFileSync(file, html);
  console.log(`en/carrers: ${changed} cards retargeted to ${wanted.map((w) => w.slug).join(', ')}`);
}
