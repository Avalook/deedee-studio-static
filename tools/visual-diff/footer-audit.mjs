/** Audit visible footer duplication across every captured route at two widths. */
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const origin = process.env.AUDIT_ORIGIN || 'http://127.0.0.1:4173';
const output = process.env.AUDIT_OUTPUT || path.join(root, 'evidence/footer-audit.json');
const routes = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')).pages;
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
let cursor = 0;
try {
  await Promise.all(Array.from({ length: 4 }, async () => {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const request = route.request();
      if (['image', 'media', 'font'].includes(request.resourceType())) return route.abort();
      if (!request.url().startsWith(origin) && !['stylesheet', 'document'].includes(request.resourceType())) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    while (cursor < routes.length) {
      const entry = routes[cursor++];
      for (const width of [1440, 390]) {
        try {
          await page.setViewportSize({ width, height: 1000 });
          const destination = `${origin}${entry.route.endsWith('/') ? entry.route : entry.route + '/'}`;
          for (let attempt = 0; attempt < 2; attempt++) {
            try { await page.goto(destination, { waitUntil: 'load', timeout: 30000 }); break; }
            catch (error) { if (attempt === 1) throw error; }
          }
          let metrics;
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              await page.waitForLoadState('load');
              metrics = await page.evaluate(() => {
            const rect = element => {
              const box = element.getBoundingClientRect();
              return { top: Math.round(box.top), height: Math.round(box.height) };
            };
            const blocks = [...document.querySelectorAll('footer, main > section')]
              .filter(element => /©/.test(element.textContent) && /contact@deedeestudio\.net/i.test(element.textContent))
              .map(element => ({ id: element.id, ...rect(element), display: getComputedStyle(element).display }));
            const visible = blocks.filter(block => block.height > 0 && block.display !== 'none');
            return { blocks, visible, pageHeight: document.documentElement.scrollHeight };
          });
              break;
            } catch (error) {
              if (attempt === 3) throw error;
              await new Promise(resolve => setTimeout(resolve, 150));
            }
          }
          results.push({ route: entry.route, width, ...metrics,
            duplicate: metrics.visible.length > 1,
            oversized: metrics.visible.some(block => block.height > (width > 800 ? 1400 : 1600)) });
        } catch (error) {
          results.push({ route: entry.route, width, error: error.message });
        }
      }
      if (results.length % 100 === 0) console.log(`Audited ${results.length} route/width combinations`);
    }
    await context.close();
  }));
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), routes: routes.length,
  checks: results.length, duplicates: results.filter(item => item.duplicate),
  oversized: results.filter(item => item.oversized), errors: results.filter(item => item.error), results };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ routes: report.routes, checks: report.checks,
  duplicates: report.duplicates.length, oversized: report.oversized.length,
  errors: report.errors.length, output }));
if (report.duplicates.length || report.oversized.length || report.errors.length) process.exitCode = 1;
