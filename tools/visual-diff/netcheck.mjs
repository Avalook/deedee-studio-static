#!/usr/bin/env node
// Open each route on the live site and on the mirror, scroll to the bottom, and compare what failed:
// requests that answered 4xx/5xx or never finished, and console errors. Only failures that happen on the
// mirror and NOT on the live site are reported as the mirror's fault. Run at 1x and 2x (Retina) pixel density,
// because srcset picks different files on a Retina screen.
//   node netcheck.mjs --local http://127.0.0.1:4173/deedee-studio-static [--routes /,/aboutus] [--dpr 1,2]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { launchOptions } from './env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const config = JSON.parse(readFileSync(path.join(HERE, 'routes.json'), 'utf8'));
const ROUTES = args['routes-file'] ? JSON.parse(readFileSync(path.resolve(args['routes-file']), 'utf8')) : args.routes ? args.routes.split(',') : config.core;
const DPRS = (args.dpr ?? '1,2').split(',').map(Number);
const LIVE = args.live ?? 'https://www.deedeestudio.net';
const LOCAL = args.local ?? 'http://127.0.0.1:4173/deedee-studio-static';
const CONCURRENCY = Number(args.concurrency ?? 3);
const OUT = path.resolve(HERE, args.out ?? 'out/netcheck');
mkdirSync(OUT, { recursive: true });

/** The same resource on both sites: drop the host, the Pages prefix and the cache-busting query. */
const keyFor = (url) => { try { const u = new URL(url); return decodeURIComponent(u.pathname.replace('/deedee-studio-static', '')) ; } catch { return url; } };

async function visit(browser, base, route, dpr) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, locale: 'vi-VN', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const failures = []; const errors = [];
  page.on('response', (response) => { if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); });
  page.on('requestfailed', (request) => { const reason = request.failure()?.errorText ?? ''; if (!/ERR_ABORTED/.test(reason)) failures.push({ url: request.url(), status: reason || 'failed' }); });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 200)); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${String(error.message).slice(0, 200)}`));
  try {
    await page.goto(`${base}${route === '/' ? '/' : route}?deedee-live-layout=1`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, document.body.scrollHeight); });
    await page.waitForTimeout(1500);
  } catch (error) { errors.push(`navigation: ${error.message.slice(0, 120)}`); }
  await context.close();
  return { failures, errors };
}

const browser = await chromium.launch(launchOptions());
const jobs = ROUTES.flatMap((route) => DPRS.map((dpr) => ({ route, dpr })));
const results = []; let cursor = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < jobs.length) {
    const { route, dpr } = jobs[cursor++];
    const [live, local] = await Promise.all([visit(browser, LIVE, route, dpr), visit(browser, LOCAL, route, dpr)]);
    const liveKeys = new Set(live.failures.map((f) => keyFor(f.url)));
    const mirrorOnly = local.failures.filter((f) => !liveKeys.has(keyFor(f.url)));
    const liveErrors = new Set(live.errors);
    const mirrorErrors = local.errors.filter((e) => !liveErrors.has(e));
    const mirrorKeys = new Set(local.failures.map((f) => keyFor(f.url)));
    const liveOnly = live.failures.filter((f) => !mirrorKeys.has(keyFor(f.url)));
    results.push({ route, dpr, liveOnlyFailures: liveOnly, mirrorOnlyFailures: mirrorOnly, mirrorOnlyErrors: mirrorErrors, liveFailures: live.failures.length, mirrorFailures: local.failures.length });
    console.log(`${mirrorOnly.length || mirrorErrors.length ? 'FAIL' : 'ok  '} ${route} @${dpr}x  mirror-only: ${mirrorOnly.length} failed requests, ${mirrorErrors.length} errors  (live had ${live.failures.length} failed)`);
  }
}));
await browser.close();
results.sort((a, b) => a.route.localeCompare(b.route) || a.dpr - b.dpr);
writeFileSync(path.join(OUT, 'netcheck.json'), JSON.stringify(results, null, 2));
const liveOnlyByHost = {};
for (const r of results) for (const f of r.liveOnlyFailures) { const key = `${f.status} ${new URL(f.url).host}`; liveOnlyByHost[key] = (liveOnlyByHost[key] ?? 0) + 1; }
if (Object.keys(liveOnlyByHost).length) { console.log('\nfailures only on the LIVE site (the mirror avoids them):'); for (const [key, n] of Object.entries(liveOnlyByHost).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`   ${n}x  ${key}`); }
const bad = results.filter((r) => r.mirrorOnlyFailures.length || r.mirrorOnlyErrors.length);
console.log(`\n${results.length - bad.length}/${results.length} clean`);
for (const r of bad) {
  console.log(`\n${r.route} @${r.dpr}x`);
  for (const f of r.mirrorOnlyFailures.slice(0, 6)) console.log(`   ${f.status}  ${f.url.slice(0, 140)}`);
  for (const e of r.mirrorOnlyErrors.slice(0, 3)) console.log(`   console: ${e}`);
}
