#!/usr/bin/env node
// Behavioural checks for the issues reported by site viewers (docs: Notion "Feedback vibe code website DeeDee").
// Runs against the local mirror only; pass --live to run the same checks on the live Wix site for comparison.
//   node functional.mjs [--live] [--width 1440]
import { chromium } from 'playwright-core';
import { contextOptions } from './env.mjs';

const args = process.argv.slice(2);
const live = args.includes('--live');
const width = Number(args[args.indexOf('--width') + 1]) || 1440;
const BASE = args.includes('--pages') ? 'https://avalook.github.io/deedee-studio-static' : live ? 'https://www.deedeestudio.net' : 'http://127.0.0.1:4173/deedee-studio-static';
const results = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function page(route) {
  const context = await browser.newContext(contextOptions(width));
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message.slice(0, 100)));
  await p.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(1500);
  p.errors = errors;
  return p;
}
const scrollAll = p => p.evaluate(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
  scrollTo(0, 0);
});
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: detail.ok, detail: detail.note });
  } catch (error) {
    results.push({ name, ok: false, detail: `error: ${error.message.split('\n')[0].slice(0, 110)}` });
  }
}

// 1. Home: partner logos scroll by themselves.
for (const route of ['/', '/en']) {
  await check(`partner ticker moves on ${route}`, async () => {
    const p = await page(route);
    await scrollAll(p);
    const sample = () => p.evaluate(() => {
      const strip = document.querySelector('[id^="gallery-horizontal-scroll-comp-"]');
      if (!strip) return [];
      const imgs = [...strip.querySelectorAll('img')].filter(i => i.getBoundingClientRect().width > 30 && i.getBoundingClientRect().right > 0);
      return imgs.slice(0, 4).map(i => Math.round(i.getBoundingClientRect().left * 10) / 10);
    });
    await p.evaluate(() => document.querySelector('[id^="gallery-horizontal-scroll-comp-"]')?.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(800);
    const a = await sample(); await p.waitForTimeout(3000); const b = await sample();
    const moved = a.length > 0 && a.some((x, i) => Math.abs(x - b[i]) > 2);
    return { ok: moved, note: `x before ${JSON.stringify(a)} after 3s ${JSON.stringify(b)}` };
  });
}

// 2. Our work: CTA goes to Contact us; "See more" loads more projects (VI and EN).
for (const route of ['/our-work', '/en/our-work']) {
  if (route === '/en/our-work') await check(`"Check out our work" links to contact on ${route}`, async () => {
    const p = await page(route);
    const href = await p.evaluate(() => document.querySelector('a[aria-label="Check out our work"]')?.getAttribute('href') ?? null);
    return { ok: !!href && /contact-us/.test(href), note: `href=${href}` };
  });
  await check(`"See more" loads more projects on ${route}`, async () => {
    const p = await page(route);
    await scrollAll(p);
    const count = () => p.evaluate(() => document.querySelectorAll('[role="listitem"]').length);
    const before = await count();
    const button = p.locator('[data-testid="buttonElement"]:visible', { hasText: /see more|xem thêm/i }).first();
    if (!(await button.count())) return { ok: false, note: 'no visible See more button' };
    await button.click(); await p.waitForTimeout(1200);
    const after = await count();
    return { ok: after > before, note: `list items ${before} -> ${after}` };
  });
}

// 3. Testimonials: "Show more" expands the quote.
for (const route of ['/testimonials', '/en/testimonials']) {
  await check(`testimonial "Show more" expands on ${route}`, async () => {
    const p = await page(route);
    await scrollAll(p);
    const button = p.locator('button[data-testid="ellipsis_text_viewer_expand_control"]:visible').first();
    if (!(await button.count())) return { ok: false, note: 'no expand control' };
    const h = () => button.evaluate(b => b.closest('[data-testid="richTextElement"], section, div')?.getBoundingClientRect().height ?? 0);
    const label = () => button.textContent();
    const before = [await h(), await label()];
    await button.click(); await p.waitForTimeout(500);
    const after = [await h(), await label()];
    return { ok: after[1] !== before[1] || after[0] > before[0], note: `${before.join(' / ')} -> ${after.join(' / ')}` };
  });
}

// 4. News articles: embedded video plays, language switch keeps the article.
const article = '/post/deedee-animation-studio-tren-bao-chi-hoc-vien-viet-nam'; // replaced below by a discovered link
await check('article video can be started (France Link)', async () => {
  const p = await page('/en/news');
  const link = await p.evaluate(() => [...document.querySelectorAll('a[href*="/post/"]')].map(a => a.getAttribute('href')).find(h => /france|hoang-thi|french/i.test(h)) ?? null);
  const target = link ?? '/en/post/deedee-and-hoang-thi-the-fate-destiny-featured-in-french-language-news-report';
  const q = await page(target.replace(/^\/deedee-studio-static/, ''));
  await scrollAll(q);
  const info = await q.evaluate(() => ({ videos: document.querySelectorAll('video').length, iframes: document.querySelectorAll('iframe').length, buttons: [...document.querySelectorAll('button')].filter(b => /play/i.test(b.getAttribute('aria-label') || b.textContent)).length }));
  const started = await q.evaluate(async () => {
    const v = document.querySelector('video'); if (!v) return null;
    try { v.muted = true; await v.play(); await new Promise(r => setTimeout(r, 800)); return v.currentTime > 0.2; } catch { return false; }
  });
  return { ok: started === true || info.iframes > 0, note: `${target.slice(-50)} video tags=${info.videos} iframes=${info.iframes} playBtns=${info.buttons} played=${started}` };
});
void article;

const switchLanguage = async (route, to) => {
  const p = await page(route);
  await scrollAll(p);
  await p.locator('[data-testid="languages-dropdown-handle"]:visible').first().click();
  await p.waitForTimeout(400);
  await p.locator(`[data-testid="dropdown-option-${to}"]:visible`).first().click();
  await p.waitForTimeout(2500);
  return new URL(p.url()).pathname.replace(/^\/deedee-studio-static/, '').replace(/\/$/, '') || '/';
};
for (const [route, to, expected] of [
  ['/post/animation-la-gi', 'en', '/en/post/animation-la-gi'],
  ['/en/post/types-jobs-animation-house', 'vi', '/en/post/types-jobs-animation-house'],
  ['/our-work', 'en', '/en/our-work'],
  ['/en/news', 'vi', '/news'],
]) {
  await check(`language switch ${route} -> ${to}`, async () => {
    const got = await switchLanguage(route, to);
    return { ok: got === expected, note: `lands on ${got} (live: ${expected})` };
  });
}

// 5. EN news pagination renders (feedback: broken next-page display).
for (const [route, label] of [['/news', 'VI'], ['/en/news', 'EN']]) {
  await check(`${label} news pagination changes the visible cards`, async () => {
    const p = await page(route);
    await scrollAll(p);
    const titles = () => p.evaluate(() => {
      const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(e => e.getBoundingClientRect().height > 0) ?? document;
      return [...panel.querySelectorAll('[data-hook="item-container"]')].filter(e => e.getBoundingClientRect().height > 0).map(e => (e.querySelector('h2')?.textContent ?? '').trim());
    });
    const a = await titles();
    const next = p.locator('[data-hook="pagination__2"]:visible').first();
    if (!(await next.count())) return { ok: false, note: 'no visible page 2 control' };
    await next.click(); await p.waitForTimeout(1500);
    const b = await titles();
    return { ok: a.length > 0 && b.length > 0 && a[0] !== b[0], note: `page 1 "${a[0]?.slice(0, 30)}" (${a.length}) -> page 2 "${b[0]?.slice(0, 30)}" (${b.length})` };
  });
}

// 6. Contact form: what happens on submit (backend wiring).
await check('contact form has a working submit target', async () => {
  const p = await page('/contact-us');
  await scrollAll(p);
  const form = await p.evaluate(() => { const f = document.querySelector('form'); return f ? { action: f.getAttribute('action'), method: f.getAttribute('method'), fields: f.querySelectorAll('input,textarea,select').length } : null; });
  return { ok: !!form && !!form.action && !/^#?$/.test(form.action), note: JSON.stringify(form) };
});

await browser.close();
const pad = (s, n) => String(s).padEnd(n);
console.log(`${args.includes('--pages') ? 'GITHUB PAGES' : live ? 'LIVE' : 'LOCAL'} @${width}px\n`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.name, 52)} ${r.detail}`);
console.log(`\n${results.filter(r => r.ok).length}/${results.length} pass`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
