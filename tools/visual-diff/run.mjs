#!/usr/bin/env node
// Pixel-diff the local mirror against the live Wix site, route x viewport.
//
//   node run.mjs                         # core routes, 4 widths
//   node run.mjs --routes /,/en/service  # explicit routes
//   node run.mjs --widths 1440,419 --concurrency 2
//
// Needs the mirror served first:  python3 ../../serve.py   (127.0.0.1:4173)
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { contextOptions, launchOptions } from './env.mjs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));

const config = JSON.parse(readFileSync(path.join(HERE, 'routes.json'), 'utf8'));
const WIDTHS = (args.widths ?? config.widths.join(',')).split(',').map(Number);
// --routes-file holds a JSON array; use it for routes that contain commas.
const ROUTES = args['routes-file'] ? JSON.parse(readFileSync(path.resolve(args['routes-file']), 'utf8')) : args.routes ? args.routes.split(',') : config.core;
const LIVE = args.live ?? 'https://www.deedeestudio.net';
const LOCAL = args.local ?? 'http://127.0.0.1:4173/deedee-studio-static';
const CONCURRENCY = Number(args.concurrency ?? 2);
const MAX_MISMATCH = Number(args['max-mismatch'] ?? config.thresholds.maxMismatchPct);
const MAX_HEIGHT_DELTA = Number(args['max-height-delta'] ?? config.thresholds.maxHeightDeltaPct);
const OUT = path.resolve(HERE, args.out ?? `out/${new Date().toISOString().replace(/[:.]/g, '-')}`);
const VIEWPORT_HEIGHT = 900;
// Viewer-requested layout changes (scripts/viewer-feedback.mjs) are switched off so the diff measures fidelity to live.
const LIVE_LAYOUT = '?deedee-live-layout=1';
const BAND = 300;

const slug = route => (route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^\p{L}\p{N}]+/gu, '_'));
// Wix reveals content by animating from opacity 0, so 'animation: none' would leave it invisible.
// Finish every animation instantly instead; fill-mode keeps the end state.
const FREEZE = `*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;animation-fill-mode:forwards!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}`;

// Playwright's fullPage shot blanks some Wix pages once they have been scrolled, so stitch viewport-sized
// tiles instead. Fixed/sticky elements (the header) are kept in the first tile and hidden in the rest.
async function tileShot(page, width, totalHeight, file) {
  const tiles = [];
  let height = totalHeight;
  for (let y = 0; y < height; y += VIEWPORT_HEIGHT) {
    await page.evaluate(async ({ y, first }) => {
      window.scrollTo(0, y);
      document.querySelectorAll('[data-vd-hidden]').forEach(e => { e.style.visibility = ''; e.removeAttribute('data-vd-hidden'); });
      if (!first) {
        for (const e of document.querySelectorAll('body *')) {
          const pos = getComputedStyle(e).position;
          if (pos === 'fixed' || pos === 'sticky') { e.setAttribute('data-vd-hidden', ''); e.style.visibility = 'hidden'; }
        }
      }
      // Large PNGs can paint blank until decoded; only wait for images that already finished loading, and only briefly.
      const onScreen = [...document.images].filter(img => { const r = img.getBoundingClientRect(); return img.complete && img.naturalWidth > 0 && r.bottom > 0 && r.top < window.innerHeight && r.width > 0; });
      await Promise.race([Promise.all(onScreen.map(img => img.decode?.().catch(() => {}))), new Promise(r => setTimeout(r, 800))]);
      await new Promise(r => setTimeout(r, 250));
    }, { y, first: y === 0 });
    const actualY = await page.evaluate(() => Math.round(window.scrollY));
    height = Math.max(height, await page.evaluate(() => document.documentElement.scrollHeight));
    tiles.push({ y: actualY, png: PNG.sync.read(await page.screenshot({ animations: 'disabled' })) });
  }
  const canvas = new PNG({ width, height });
  canvas.data.fill(255);
  for (const { y, png } of tiles) PNG.bitblt(png, canvas, 0, 0, Math.min(width, png.width), Math.min(png.height, height - y), 0, y);
  writeFileSync(file, PNG.sync.write(canvas));
}

async function capture(browser, url, width, file) {
  const context = await browser.newContext(contextOptions(width, VIEWPORT_HEIGHT));
  const page = await context.newPage();
  try {
    await page.addInitScript(css => {
      const apply = () => {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
    }, FREEZE);
    const response = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    // Alias routes redirect with <meta http-equiv=refresh>; let the navigation finish before touching the page.
    await page.waitForTimeout(700);
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts?.ready);
    // Walk the page so lazy images and reveal-on-scroll content hydrate before the shot.
    await page.evaluate(async step => {
      const pause = ms => new Promise(r => setTimeout(r, ms));
      let y = 0;
      for (let i = 0; i < 120; i += 1) {
        const bottom = document.documentElement.scrollHeight;
        if (y >= bottom) break;
        window.scrollTo(0, y);
        y += step;
        await pause(120);
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await pause(300);
    }, Math.round(VIEWPORT_HEIGHT * 0.8));
    // Infinite-scroll feeds (blog categories) add a batch only after the previous one has rendered; keep going until the height settles.
    let stable = 0;
    let lastHeight = 0;
    for (let i = 0; i < 24 && stable < 3; i += 1) {
      // Nudge up first: a feed only loads on a scroll event, and sitting at the bottom fires none.
      const height = await page.evaluate(async () => {
        window.scrollTo(0, Math.max(0, document.documentElement.scrollHeight - window.innerHeight - 400));
        await new Promise(resolve => setTimeout(resolve, 150));
        window.scrollTo(0, document.documentElement.scrollHeight);
        return document.documentElement.scrollHeight;
      });
      stable = height === lastHeight ? stable + 1 : 0;
      lastHeight = height;
      await page.waitForTimeout(1500);
    }
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    // Background videos loop; compare every site at frame 0 or the hero never matches.
    await page.evaluate(async () => {
      await Promise.all([...document.querySelectorAll('video')].map(video => new Promise(resolve => {
        video.pause();
        video.loop = false;
        const done = () => resolve();
        video.addEventListener('seeked', done, { once: true });
        setTimeout(done, 2500);
        video.currentTime = 0;
      })));
    });
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      title: document.title,
    }));
    await tileShot(page, width, metrics.scrollHeight, file);
    return { status: response?.status() ?? 0, ...metrics };
  } finally {
    await context.close();
  }
}

function compare(liveFile, localFile, diffFile) {
  const a = PNG.sync.read(readFileSync(liveFile));
  const b = PNG.sync.read(readFileSync(localFile));
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (img) => {
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const ca = crop(a);
  const cb = crop(b);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(ca.data, cb.data, diff.data, width, height, { threshold: 0.15, includeAA: false });
  writeFileSync(diffFile, PNG.sync.write(diff));
  const bands = [];
  for (let y = 0; y < height; y += BAND) {
    const h = Math.min(BAND, height - y);
    let n = 0;
    for (let row = y; row < y + h; row += 1) {
      const base = row * width * 4;
      for (let x = 0; x < width; x += 1) {
        const i = base + x * 4;
        if (diff.data[i] > 200 && diff.data[i + 1] < 100) n += 1;
      }
    }
    bands.push({ y, pct: +(100 * n / (width * h)).toFixed(2) });
  }
  return {
    liveSize: [a.width, a.height],
    localSize: [b.width, b.height],
    heightDeltaPx: b.height - a.height,
    heightDeltaPct: +(100 * Math.abs(b.height - a.height) / a.height).toFixed(2),
    mismatchPct: +(100 * mismatched / (width * height)).toFixed(2),
    worstBands: bands.sort((x, y) => y.pct - x.pct).slice(0, 4),
  };
}

async function runCell(browser, route, width) {
  const dir = path.join(OUT, slug(route), String(width));
  mkdirSync(dir, { recursive: true });
  const liveFile = path.join(dir, 'live.png');
  const localFile = path.join(dir, 'local.png');
  const encoded = route.split('/').map(encodeURIComponent).join('/');
  const cell = { route, width };
  try {
    const [live, local] = await Promise.all([
      capture(browser, LIVE + encoded, width, liveFile),
      capture(browser, LOCAL + encoded + LIVE_LAYOUT, width, localFile),
    ]);
    cell.live = live;
    cell.local = local;
    cell.overflow = { live: live.scrollWidth > width, local: local.scrollWidth > width };
    Object.assign(cell, compare(liveFile, localFile, path.join(dir, 'diff.png')));
    const reasons = [];
    if (live.status >= 400) reasons.push(`live HTTP ${live.status}`);
    if (local.status >= 400) reasons.push(`local HTTP ${local.status}`);
    if (cell.mismatchPct > MAX_MISMATCH) reasons.push(`mismatch ${cell.mismatchPct}% > ${MAX_MISMATCH}%`);
    if (cell.heightDeltaPct > MAX_HEIGHT_DELTA) reasons.push(`height Δ ${cell.heightDeltaPx}px (${cell.heightDeltaPct}%)`);
    if (cell.overflow.local && !cell.overflow.live) reasons.push('local-only horizontal overflow');
    cell.pass = reasons.length === 0;
    cell.reasons = reasons;
  } catch (error) {
    cell.pass = false;
    cell.reasons = [`error: ${error.message.split('\n')[0]}`];
  }
  return cell;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(launchOptions());
  const queue = ROUTES.flatMap(route => WIDTHS.map(width => ({ route, width })));
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const { route, width } = queue[next++];
      const cell = await runCell(browser, route, width);
      results.push(cell);
      const tag = cell.pass ? 'PASS' : 'FAIL';
      console.log(`${tag} ${route} @${width}  mismatch=${cell.mismatchPct ?? '-'}%  heightΔ=${cell.heightDeltaPx ?? '-'}px  ${cell.reasons?.join('; ') ?? ''}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();

  results.sort((a, b) => a.route.localeCompare(b.route) || b.width - a.width);
  writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const rows = results.map(c => `| ${c.route} | ${c.width} | ${c.pass ? 'pass' : 'FAIL'} | ${c.mismatchPct ?? '-'} | ${c.heightDeltaPx ?? '-'} | ${(c.worstBands ?? []).map(b => `${b.y}:${b.pct}%`).join(' ')} | ${(c.reasons ?? []).join('; ')} |`);
  writeFileSync(path.join(OUT, 'summary.md'), ['| route | width | result | mismatch % | height Δ px | worst 300px bands (y:%) | notes |', '|---|---|---|---|---|---|---|', ...rows].join('\n'));
  const failed = results.filter(c => !c.pass).length;
  console.log(`\n${results.length - failed}/${results.length} cells pass. Report: ${OUT}/summary.md`);
  process.exitCode = failed ? 1 : 0;
}

main().catch(error => { console.error(error); process.exitCode = 2; });
