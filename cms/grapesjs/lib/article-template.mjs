import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { bakeSeo, seoTags } from './seo-bake.mjs';

/**
 * A CMS article is rendered by filling a real article page of the site, so it has the same header, footer, fonts and
 * article layout as the pages Wix produced. Only the title, date, reading time, body, category and head tags change.
 */
export const ARTICLE_TEMPLATES = {
  vi: 'post/chia-khoa-cho-mot-quy-trinh-hop-tac-quoc-te/index.html',
  en: 'en/post/does-adult-animation-always-look-mature/index.html',
};
const SITE_BASE = '/deedee-studio-static';
const CATEGORY_ROUTES = {
  vi: { 'hoạt động': '/blog/categories/hoạt-động/', 'góc chuyên gia': '/blog/categories/talk-interview/', 'kiến thức': '/blog/categories/knowledge/' },
  en: { activities: '/en/blog/categories/hoạt-động-1/', 'expert talk': '/en/blog/categories/talk-interview-2/', academy: '/en/blog/categories/knowledge-1/' },
};
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const escapeText = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (value) => escapeText(value).replace(/"/g, '&quot;');

export async function loadArticleTemplates(sourceDir) {
  const entries = await Promise.all(Object.entries(ARTICLE_TEMPLATES).map(async ([language, file]) => [language, await readFile(path.join(sourceDir, file), 'utf8')]));
  return Object.fromEntries(entries);
}

function baseUrl(value, base) {
  const url = String(value || '');
  if (/^\/(?!\/)[^\s<>"\\]*$/.test(url)) return base && !url.startsWith(`${base}/`) && url !== base ? `${base}${url}` : url;
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch { return ''; }
}

export function readingMinutes(html) {
  const words = String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function displayDate(iso, language) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDate(); const month = date.getUTCMonth(); const year = date.getUTCFullYear();
  const sameYear = year === new Date().getUTCFullYear();
  if (language === 'en') return `${MONTHS_EN[month]} ${day}${sameYear ? '' : `, ${year}`}`;
  return `${day} thg ${month + 1}${sameYear ? '' : `, ${year}`}`;
}

const PARAGRAPH_STYLE = 'padding-top:7px;padding-bottom:7px;line-height:max(0.8em, 1.15em)';

/** Inline markup of sanitized body HTML, in the weights and colours the site's articles use. */
function inline(html, base) {
  return html
    .replace(/<strong>/g, '<strong style="font-weight:700">').replace(/<b>/g, '<strong style="font-weight:700">').replace(/<\/b>/g, '</strong>')
    .replace(/<em>/g, '<em style="font-style:italic">').replace(/<i>/g, '<em style="font-style:italic">').replace(/<\/i>/g, '</em>')
    .replace(/<a href="([^"]*)"[^>]*>/g, (_m, href) => `<a href="${escapeAttr(baseUrl(href.replace(/&amp;/g, '&'), base) || href)}" rel="noopener noreferrer" style="color:#A139E0;text-decoration:underline">`);
}

function paragraph(content) {
  return `<div data-breakout="normal"><p class="-wHo1 Z1Rmx IPM-j lxswf" style="${PARAGRAPH_STYLE}" dir="auto" tabindex="-1"><span class="mQy7D">${content}</span></p></div>`;
}

function heading(content, level) {
  const tag = level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
  return `<div data-breakout="normal"><${tag} class="Vhttk _91pHl IPM-j lxswf" style="${PARAGRAPH_STYLE}" dir="auto" tabindex="-1"><span class="_3RJX8"><span style="color:#A139E0;text-decoration:inherit">${content}</span></span></${tag}></div>`;
}

function image(src, alt, base) {
  const url = baseUrl(src, base);
  if (!url) return '';
  return `<div data-breakout="normal"><div class="_5GlQR" style="margin:7px 0" tabindex="-1"><div class="-p-8- ha4EC"><figure class="oH3fR"><div class="GOrrM"><img src="${escapeAttr(url)}" alt="${escapeAttr(alt || '')}" loading="lazy" style="display:block;width:100%;height:auto;margin:0 auto"></div></figure></div></div></div>`;
}

const BLOCK = /^(p|h[2-4]|ul|ol|blockquote|figure|hr|img)$/;

/** Split sanitized HTML into its top-level blocks. */
function topLevel(html) {
  const blocks = [];
  let depth = 0;
  let start = 0;
  let pending = '';
  const flushText = (text) => { if (text.trim()) pending += text; };
  for (const match of html.matchAll(/<(\/?)([a-z0-9]+)\b[^>]*?(\/?)>/gi)) {
    const [tag, closing, name, selfClosing] = match;
    const isVoid = ['br', 'hr', 'img'].includes(name) || selfClosing === '/';
    if (depth === 0) {
      flushText(html.slice(start, match.index));
      if (!closing && BLOCK.test(name) && !isVoid) { if (pending.trim()) { blocks.push({ name: 'p', inner: pending }); pending = ''; } start = match.index; depth = 1; continue; }
      if (!closing && isVoid && ['hr', 'img'].includes(name)) { if (pending.trim()) { blocks.push({ name: 'p', inner: pending }); pending = ''; } blocks.push({ name, tag }); start = match.index + tag.length; continue; }
      pending += tag; start = match.index + tag.length; continue;
    }
    if (closing) depth -= 1; else if (!isVoid) depth += 1;
    if (depth === 0) {
      const outer = html.slice(start, match.index + tag.length);
      const name0 = /^<([a-z0-9]+)/i.exec(outer)[1].toLowerCase();
      blocks.push({ name: name0, inner: outer.replace(/^<[^>]*>/, '').replace(/<\/[^>]+>$/, ''), outer });
      start = match.index + tag.length;
    }
  }
  flushText(html.slice(start));
  if (pending.trim()) blocks.push({ name: 'p', inner: pending });
  return blocks;
}

export function articleBlocks(bodyHtml, base = '') {
  const out = [];
  for (const block of topLevel(String(bodyHtml || ''))) {
    const content = block.inner !== undefined ? inline(block.inner, base) : '';
    if (block.name === 'p') { if (content.replace(/<br\s*\/?>|\s/g, '')) out.push(paragraph(content)); }
    else if (/^h[2-4]$/.test(block.name)) out.push(heading(content, Number(block.name[1])));
    else if (block.name === 'ul' || block.name === 'ol') out.push(`<div data-breakout="normal"><${block.name} style="${PARAGRAPH_STYLE};margin:0;padding-left:1.6em;list-style:${block.name === 'ul' ? 'disc' : 'decimal'} outside" dir="auto">${content.replace(/<li>/g, '<li style="padding:3px 0;list-style:inherit">')}</${block.name}></div>`);
    else if (block.name === 'blockquote') out.push(`<div data-breakout="normal"><blockquote style="${PARAGRAPH_STYLE};margin:12px 0;padding-left:20px;border-left:4px solid #A139E0" dir="auto">${content}</blockquote></div>`);
    else if (block.name === 'hr') out.push('<div data-breakout="normal"><hr style="border:0;border-top:1px solid rgba(0,0,0,.2);margin:20px 0"></div>');
    else if (block.name === 'img') {
      const src = /src="([^"]*)"/.exec(block.tag)?.[1]; const alt = /alt="([^"]*)"/.exec(block.tag)?.[1];
      out.push(image(src && src.replace(/&amp;/g, '&'), alt, base));
    } else if (block.name === 'figure') {
      const tag = /<img\b[^>]*>/.exec(block.inner)?.[0] || '';
      const caption = /<figcaption>([\s\S]*?)<\/figcaption>/.exec(block.inner)?.[1];
      out.push(image(/src="([^"]*)"/.exec(tag)?.[1]?.replace(/&amp;/g, '&'), /alt="([^"]*)"/.exec(tag)?.[1], base));
      if (caption) out.push(paragraph(`<em style="font-style:italic">${inline(caption, base)}</em>`));
    }
  }
  return out.join('');
}

/** Index just past the element that opens at `start`, matching its own tag name. */
function elementEnd(html, start, name) {
  const re = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  for (let match = re.exec(html); match; match = re.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return -1;
}

function replaceRange(html, start, end, replacement) {
  return html.slice(0, start) + replacement + html.slice(end);
}

export function renderArticleFromTemplate(item, { template, basePath = '', siteOrigin = '' } = {}) {
  if (!template) throw new Error('Article template is missing');
  const language = item.language === 'en' ? 'en' : 'vi';
  const base = basePath === SITE_BASE ? SITE_BASE : '';
  let html = template;
  // Previews are served from the CMS root; published pages live under the site's base path.
  if (!base) html = html.split(`"${SITE_BASE}/`).join('"/').split(`(${SITE_BASE}/`).join('(/');

  // Body: everything between the first and last block markers of the article content.
  const first = html.indexOf('<div type="first" data-hook="rcv-block-first"></div>');
  const last = html.indexOf('<div type="last" data-hook="rcv-block-last"></div>');
  if (first < 0 || last < first) throw new Error('Article template has no content area');
  const cover = item.cover ? image(item.cover, item.title, base) : '';
  const bodyStart = first + '<div type="first" data-hook="rcv-block-first"></div>'.length;
  html = replaceRange(html, bodyStart, last, `<div class="nJKz-">${cover}${articleBlocks(item.bodyHtml, base)}</div>`);

  // Title, date and reading time.
  html = html.replace(/(<h1 class="H3vOVf" data-hook="post-title">)[\s\S]*?(<\/h1>)/, (_m, a, b) => `${a}${escapeText(item.title)}${b}`);
  const date = displayDate(item.publishedAt, language);
  const minutes = readingMinutes(item.bodyHtml);
  const readLabel = language === 'en' ? `${minutes} min read` : `${minutes} phút đọc`;
  html = html.replace(/<span title="[^"]*" class="time-ago" data-hook="time-ago">[\s\S]*?<\/span>/, `<span title="${escapeAttr(date)}" class="time-ago" data-hook="time-ago">${escapeText(date)}</span>`);
  html = html.replace(/<span title="[^"]*" data-hook="time-to-read">[\s\S]*?<\/span>/, `<span title="${escapeAttr(readLabel)}" data-hook="time-to-read">${escapeText(readLabel)}</span>`);

  // Category link in the post footer.
  const category = String(item.category || '').trim();
  if (category) {
    const route = CATEGORY_ROUTES[language][category.toLowerCase()];
    const target = route ? `${base}${route}` : '';
    const link = target ? `<a href="${escapeAttr(target)}" class="Tp7c0d" data-hook="link">${escapeText(category)}</a>` : `<span class="Tp7c0d">${escapeText(category)}</span>`;
    html = html.replace(/(<ul class="pRGtWE" aria-label="Post categories">)[\s\S]*?(<\/ul>)/, (_m, a, b) => `${a}<li>${link}</li>${b}`);
  }

  // Related posts belong to the template's article, not this one.
  const related = html.indexOf('<div class="zp8IQu zp8s_J">');
  if (related >= 0) {
    const end = elementEnd(html, related, 'div');
    if (end > related) html = replaceRange(html, related, end, '');
  }

  // Comments section gets its own id.
  const slugId = createHash('sha1').update(item.route || item.slug || item.title).digest('hex').slice(0, 24);
  html = html.replace(/(wc-root |root-comment-box-start-|comment-list-inner-)[0-9a-f]{24}/g, `$1${slugId}`);

  // Head: canonical, hreflang, title and share tags.
  const url = `${base}${item.route}`;
  html = html.replace(/<link rel="alternate" href="[^"]*" hreflang="[^"]*">/g, '');
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeAttr(siteOrigin ? siteOrigin + url : url)}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeAttr(url)}">`);
  const wanted = seoTags({ title: `${item.title} | DeeDee Studio`, description: item.summary || undefined, image: item.cover || undefined },
    { imageUrl: (value) => (value.startsWith('/') ? `${siteOrigin}${baseUrl(value, base)}` : value) });
  return bakeSeo(html, wanted).html;
}
