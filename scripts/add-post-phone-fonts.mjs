// On a phone the live article pages use smaller/larger heading sizes than the desktop snapshot the mirror was built from
// (h1 26px, h2 24px, h3 20px, h5 16px, h6 14px, quote 20px; the font families are the same).
// Generate assets/post-phone-fonts.css from the page's own font variables and link it from every article page. Idempotent.
//   node scripts/add-post-phone-fonts.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/deedee-studio-static';
const SECTION = 'TPAMultiSection_l9pap7zt';
export const PHONE = { H1: '26px/37px', H2: '24px/27px', H3: '20px/22px', H5: '16px/22px', H6: '14px/22px', Quote: '20px/22px' };
const MARK = 'data-deedee-post-phone-fonts';

/** `--textH1Font: normal normal bold 30px/37px <families>` -> same value with the phone size. */
export function phoneFontRules(html) {
  const lines = [];
  for (const [name, size] of Object.entries(PHONE)) {
    const m = html.match(new RegExp(`--text${name}Font:\\s*((?:italic|normal)\\s+(?:normal)\\s+(?:bold|normal)\\s+)\\d+(?:\\.\\d+)?px\\/[\\d.]+px\\s+([^;]+);`));
    if (!m) continue;
    const [px, lineHeight] = size.split('/');
    // Rich text headings read the size and line height from their own variables, not from the shorthand.
    lines.push(`    --text${name}Font: ${m[1]}${size} ${m[2].trim()};`, `    --text${name}Font-size: ${px};`, `    --text${name}Font-line-height: ${lineHeight};`);
  }
  return lines;
}

export function phoneCss(lines) {
  return `/* Heading sizes the live article pages use on a phone (touch screen, up to 600px). */\n@media screen and (max-width: 600px) and (hover: none) and (pointer: coarse) {\n  body .${SECTION} {\n${lines.join('\n')}\n  }\n}\n`;
}

function* articleFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, 'index.html');
    if (existsSync(file)) yield file;
  }
}

export function link(html) {
  const tag = `<link rel="stylesheet" ${MARK} href="${BASE}/assets/post-phone-fonts.css?v=1">`;
  if (html.includes(MARK) || !html.includes(SECTION)) return { html, changed: false };
  return { html: html.replace('</head>', `${tag}</head>`), changed: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sample = readFileSync(path.join(ROOT, 'post/animation-la-gi/index.html'), 'utf8');
  const lines = phoneFontRules(sample);
  if (lines.length !== Object.keys(PHONE).length * 3) throw new Error(`found ${lines.length} font variables in the sample page`);
  writeFileSync(path.join(ROOT, 'assets/post-phone-fonts.css'), phoneCss(lines));
  let pages = 0; let changed = 0;
  for (const dir of ['post', 'en/post']) for (const file of articleFiles(path.join(ROOT, dir))) {
    pages += 1; const result = link(readFileSync(file, 'utf8'));
    if (result.changed) { writeFileSync(file, result.html); changed += 1; }
  }
  console.log(`post-phone-fonts.css written; linked from ${changed} of ${pages} article pages`);
}
