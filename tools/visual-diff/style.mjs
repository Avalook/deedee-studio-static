#!/usr/bin/env node
// Diff computed styles of one element (and its first few descendants) between live and local.
//   node style.mjs /privacy-policy 1440 '[id$="_r_comp-m8np3cca-menu-content"]' [--depth=3]
import { chromium } from 'playwright-core';
const [route, widthArg, selector, ...rest] = process.argv.slice(2);
const depth = Number((rest.find(a => a.startsWith('--depth=')) ?? '--depth=2').split('=')[1]);
const BASES = { live: 'https://www.deedeestudio.net', local: 'http://127.0.0.1:4173/deedee-studio-static' };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function dump(base) {
  const page = await (await browser.newContext({ viewport: { width: Number(widthArg), height: 900 }, reducedMotion: 'reduce', locale: 'vi-VN' })).newPage();
  await page.goto(base + route.split('/').map(encodeURIComponent).join('/'), { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 720) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } });
  await page.waitForTimeout(1200);
  return page.evaluate(({ selector, depth }) => {
    const root = document.querySelector(selector);
    if (!root) return null;
    const rows = [];
    const walk = (el, d, path) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const style = {};
      for (const p of cs) style[p] = cs.getPropertyValue(p);
      rows.push({ path, tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : ''), rect: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)], style, text: (el.innerText || '').trim().slice(0, 24) });
      if (d > 0) [...el.children].slice(0, 6).forEach((c, i) => walk(c, d - 1, path + '>' + i));
    };
    walk(root, depth, 'root');
    return rows;
  }, { selector, depth });
}
const [live, local] = [await dump(BASES.live), await dump(BASES.local)];
await browser.close();
if (!live || !local) { console.log('selector missing on', !live ? 'live' : 'local'); process.exit(1); }
const IGNORE = /^(block-size|inline-size|perspective-origin|transform-origin|-webkit-locale|min-block-size|min-inline-size|inset-|margin-block|margin-inline|padding-block|padding-inline|border-block|border-inline|--)/;
live.forEach((a, i) => {
  const b = local[i]; if (!b) return;
  const diffs = Object.keys(a.style).filter(k => !IGNORE.test(k) && a.style[k] !== b.style[k]).map(k => `${k}: ${a.style[k]} → ${b.style[k]}`);
  console.log(`${a.path} <${a.tag}> "${a.text}" rect live=${a.rect} local=${b.rect}`);
  diffs.slice(0, 14).forEach(d => console.log('     ' + d.slice(0, 170)));
});
