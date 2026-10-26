#!/usr/bin/env node
// Compare Wix component geometry (ids are preserved by the mirror) between live and local.
//
//   node layout.mjs /privacy-policy 1440
//
// Prints the components whose size or position diverges, in page order, marking the first one that
// introduces a vertical shift. Much faster than reading pixel diffs by eye.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { contextOptions, launchOptions } from './env.mjs';

const [route = '/', widthArg = '1440', ...rest] = process.argv.slice(2);
const width = Number(widthArg);
const LIVE = 'https://www.deedeestudio.net';
const LOCAL = 'http://127.0.0.1:4173/deedee-studio-static';
const TOL = 2;
const limit = Number((rest.find(a => a.startsWith('--limit=')) ?? '--limit=25').split('=')[1]);
void path.dirname(fileURLToPath(import.meta.url));

async function collect(browser, base) {
  const context = await browser.newContext(contextOptions(width));
  const page = await context.newPage();
  await page.goto(base + route.split('/').map(encodeURIComponent).join('/') + (base === LOCAL ? '?deedee-live-layout=1' : ''), { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 720) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const data = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[id^="comp-"],footer,header,#SITE_FOOTER,#SITE_HEADER,#PAGES_CONTAINER')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const id = el.id || el.tagName.toLowerCase();
      if (id in out) continue;
      out[id] = { top: Math.round(r.top + scrollY), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40) };
    }
    return { out, height: document.documentElement.scrollHeight };
  });
  await context.close();
  return data;
}

const browser = await chromium.launch(launchOptions());
const [live, local] = await Promise.all([collect(browser, LIVE), collect(browser, LOCAL)]);
await browser.close();

const ids = Object.keys(live.out).filter(id => id in local.out).sort((a, b) => live.out[a].top - live.out[b].top);
const onlyLive = Object.keys(live.out).filter(id => !(id in local.out) && live.out[id].h > 20);
const onlyLocal = Object.keys(local.out).filter(id => !(id in live.out) && local.out[id].h > 20);
console.log(`${route} @${width}: page height live=${live.height} local=${local.height} (Δ${local.height - live.height})`);
console.log(`components compared=${ids.length} onlyLive=${onlyLive.length} onlyLocal=${onlyLocal.length}\n`);

let prevShift = 0;
let shown = 0;
for (const id of ids) {
  const a = live.out[id];
  const b = local.out[id];
  const shift = b.top - a.top;
  const dh = b.h - a.h;
  const dw = b.w - a.w;
  const dl = b.left - a.left;
  const introduces = Math.abs(shift - prevShift) > TOL;
  if (introduces || Math.abs(dh) > TOL || Math.abs(dw) > TOL || Math.abs(dl) > TOL) {
    if (shown++ < limit) {
      console.log(`${introduces ? '▶' : ' '} ${id.padEnd(22)} live y=${a.top} h=${a.h} w=${a.w} x=${a.left} | local y=${b.top} h=${b.h} w=${b.w} x=${b.left} | shift=${shift} dh=${dh} dw=${dw} dx=${dl}  "${a.text}"`);
    }
  }
  prevShift = shift;
}
if (shown > limit) console.log(`… ${shown - limit} more`);
if (onlyLive.length) console.log('\nonly on live :', onlyLive.slice(0, 8).map(id => `${id}(${live.out[id].top},${live.out[id].h})`).join(' '));
if (onlyLocal.length) console.log('only on local:', onlyLocal.slice(0, 8).map(id => `${id}(${local.out[id].top},${local.out[id].h})`).join(' '));
