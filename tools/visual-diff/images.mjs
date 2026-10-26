#!/usr/bin/env node
// Audit images that are cropped by CSS (object-fit: cover): file aspect ratio vs displayed box ratio.
// Wix serves live images already cropped to the box, so a large mismatch on local means the mirror kept a
// differently-shaped crop and the visible area differs from live.
//   node images.mjs /news 1440 [--list]
import { chromium } from 'playwright-core';
import { contextOptions } from './env.mjs';

const [route = '/', widthArg = '1440', ...rest] = process.argv.slice(2);
const list = rest.includes('--list');
const BASES = { live: 'https://www.deedeestudio.net', local: 'http://127.0.0.1:4173/deedee-studio-static' };
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function audit(base) {
  const page = await (await browser.newContext(contextOptions(Number(widthArg)))).newPage();
  await page.goto(base + route.split('/').map(encodeURIComponent).join('/'), { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } scrollTo(0, 0); });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const rows = await page.evaluate(() => [...document.images].map(img => {
    const r = img.getBoundingClientRect();
    if (r.width < 60 || r.height < 40 || !img.naturalWidth) return null;
    const cs = getComputedStyle(img);
    if (cs.objectFit !== 'cover' && cs.objectFit !== 'fill') return null;
    const nat = img.naturalWidth / img.naturalHeight, box = r.width / r.height;
    return { src: (img.currentSrc || img.src).split('/').pop().slice(0, 44), nat: +nat.toFixed(2), box: +box.toFixed(2), off: +(Math.abs(nat / box - 1)).toFixed(2), px: [img.naturalWidth, img.naturalHeight, Math.round(r.width), Math.round(r.height)] };
  }).filter(Boolean));
  await page.close();
  return rows;
}
const result = {};
for (const [name, base] of Object.entries(BASES)) result[name] = await audit(base);
await browser.close();
for (const [name, rows] of Object.entries(result)) {
  const bad = rows.filter(r => r.off > 0.1);
  console.log(`${name.padEnd(6)} cover-images=${rows.length} aspect-mismatch(>10%)=${bad.length}`);
  if (list) bad.slice(0, 12).forEach(r => console.log('   ', r.src.padEnd(46), `file ${r.nat} vs box ${r.box}`, r.px.join('x')));
}
