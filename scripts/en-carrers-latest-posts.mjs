// /en/carrers lists three activity cards; live now shows the three newest posts, which are also the first three cards
// of /en/careers. Copy their title and link into the three cards of /en/carrers and use live's 16:9 thumbnails. Idempotent.
//   node scripts/en-carrers-latest-posts.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ITEM = /(?=<div\b[^>]*data-hook="item-container")/;
const ITEMS_END = '<div data-key="items-styles"';
const SLUG = /\/en\/post\/([^/"]+)\//;
const ALT = /<img\b[^>]*\balt="([^"]*)"/;
const SRC = /<img\b[^>]*\bsrc="([^"]+)"/g;
// Live's card thumbnails (w_387,h_218 fills); the local copies of these posts' images are 4:3 crops.
const SHARP = {
  'does-adult-animation-always-look-mature': '/deedee-studio-static/assets/en-carrers-398383_cf538bb11ea94f448a49562f6bff2de2.jpg',
  'how-deedee-brought-hand-inked-look-into-digital-animation': '/deedee-studio-static/assets/en-carrers-398383_234739e5e7b641148e942f30283bafa6.jpg',
  'what-s-the-key-to-seamless-international-collaboration': '/deedee-studio-static/assets/en-carrers-398383_97ffbed2702441f9875b654cbcdaa773.jpg',
};

/** The gallery's items, cut at the end of the item list so the last card never runs into the rest of the page. */
function split(html, galleryId) {
  const start = html.indexOf(`id="pro-gallery-${galleryId}"`);
  if (start < 0) throw new Error(`gallery ${galleryId} not found`);
  const end = html.indexOf(ITEMS_END, start);
  const stop = end < 0 ? html.length : end;
  return { head: html.slice(0, start), parts: html.slice(start, stop).split(ITEM), tail: html.slice(stop) };
}

/** Cards of one gallery as { slug, title (raw HTML text), images[] }. */
export function cards(html, galleryId) {
  return split(html, galleryId).parts.slice(1).map((raw) => {
    const slug = raw.match(SLUG)?.[1]; const title = raw.match(ALT)?.[1];
    return { slug, title, images: [...raw.matchAll(SRC)].map((m) => m[1]) };
  });
}

/** Rewrite the first `wanted.length` cards of `galleryId` in `html` to show the wanted posts. */
export function retarget(html, galleryId, wanted) {
  const { head, parts, tail } = split(html, galleryId);
  let changed = 0;
  for (const [i, want] of wanted.entries()) {
    const raw = parts[i + 1]; if (!raw) continue;
    const slug = raw.match(SLUG)?.[1]; const title = raw.match(ALT)?.[1];
    const image = want.images.at(-1);
    let next = raw;
    if (slug && slug !== want.slug) next = next.split(slug).join(want.slug);
    if (title && title !== want.title) next = next.split(title).join(want.title);
    for (const old of new Set([...raw.matchAll(SRC)].map((m) => m[1]))) {
      if (old !== image) next = next.split(`src="${old}"`).join(`src="${image}"`);
    }
    if (next !== raw) { parts[i + 1] = next; changed += 1; }
  }
  return { html: head + parts.join('') + tail, changed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const careers = readFileSync(path.join(ROOT, 'en/careers/index.html'), 'utf8');
  const wanted = cards(careers, 'comp-m8cy9ggi').slice(0, 3)
    .map((card) => (SHARP[card.slug] ? { ...card, images: [SHARP[card.slug]] } : card));
  const file = path.join(ROOT, 'en/carrers/index.html');
  const { html, changed } = retarget(readFileSync(file, 'utf8'), 'comp-m8hitxkn', wanted);
  if (changed) writeFileSync(file, html);
  console.log(`en/carrers: ${changed} cards retargeted to ${wanted.map((w) => w.slug).join(', ')}`);
}
